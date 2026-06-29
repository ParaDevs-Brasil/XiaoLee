"""
cctp_client.py — Circle CCTP v2: bridge USDC de qualquer chain EVM para o Arc.

FLUXO COMPLETO (4 passos, todos auditáveis on-chain):
    1. approve()          USDC.approve(TokenMessenger, amount) na chain fonte
    2. depositForBurn()   queima USDC, emite MessageSent(bytes message)
    3. poll_attestation() aguarda Circle assinar o proof (iris-api, até 5 min)
    4. receive_on_arc()   ArcNativeClient.receive_cctp_message(raw_message, attest)

DIFERENCIAL vs. implementação naive:
  - raw_message é extraído do evento MessageSent e passado integralmente ao
    receiveMessage() — a versão bugada passava keccak256(message) (32 bytes),
    o que reverte silenciosamente no contrato.
  - approve é minerado antes do depositForBurn (sem race condition de nonce).
  - attestation é decodificada de hex antes de enviar ao contrato.
  - BridgeState rastreia cada etapa — recovery após crash sem duplo burn.
  - Sandbox simula E2E sem tocar contratos ou Circle API.

Contratos CCTP v2 Sepolia (defaults embutidos — não altere sem checar o
Circle docs, esses endereços são estáveis em testnet):
    TokenMessenger:     0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5
    MessageTransmitter: 0x7865fAfC2db2093669d92c0197ea5d5852Ab1e6f
    USDC:               0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import httpx

LOG = logging.getLogger(__name__)

# ── Circle Attestation API ──────────────────────────────────────────────────
_IRIS_SANDBOX = "https://iris-api-sandbox.circle.com/v1/attestations"
_IRIS_LIVE    = "https://iris-api.circle.com/v1/attestations"

# ── Contratos CCTP v2 em Ethereum Sepolia ──────────────────────────────────
_SEPOLIA_TOKEN_MESSENGER     = "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"
_SEPOLIA_MSG_TRANSMITTER     = "0x7865fAfC2db2093669d92c0197ea5d5852Ab1e6f"
_SEPOLIA_USDC                = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
_CCTP_DOMAIN_ETHEREUM        = 0

# ── Tópico do evento MessageSent (keccak256 da assinatura) ─────────────────
_MESSAGE_SENT_TOPIC = (
    "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036"
)

# ── Timings ─────────────────────────────────────────────────────────────────
_ATTEST_INITIAL_WAIT_S = 8.0    # Circle leva alguns segundos após o burn
_ATTEST_INTERVAL_S     = 4.0
_ATTEST_TIMEOUT_S      = 300.0
_TX_TIMEOUT_S          = 120.0

# ── ABIs (source chain — apenas funções necessárias) ────────────────────────
_USDC_ABI = [
    {
        "name": "approve",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount",  "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "decimals",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint8"}],
    },
]

_TOKEN_MESSENGER_ABI = [
    {
        "name": "depositForBurn",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "amount",            "type": "uint256"},
            {"name": "destinationDomain", "type": "uint32"},
            {"name": "mintRecipient",     "type": "bytes32"},
            {"name": "burnToken",         "type": "address"},
        ],
        "outputs": [{"name": "nonce", "type": "uint64"}],
    },
]


# ── Enums + dataclasses ─────────────────────────────────────────────────────

class BridgeStep(str, Enum):
    PENDING      = "pending"
    BURNED       = "burned"        # depositForBurn minerado
    ATTESTING    = "attesting"     # aguardando iris-api
    ATTESTED     = "attested"      # Circle assinou o proof
    RECEIVED     = "received"      # receiveMessage minerado no Arc


@dataclass
class BridgeState:
    """
    Rastreia o progresso de um bridge para possibilitar recovery após crash.
    Se o processo morrer depois do burn mas antes do receive, você pode
    chamar CCTPClient.finalize_bridge(state) com o state salvo.
    """
    step:            BridgeStep = BridgeStep.PENDING
    source_tx_hash:  str        = ""
    raw_message:     bytes      = field(default_factory=bytes)  # bytes do MessageSent
    message_hash:    str        = ""                            # keccak256(raw_message)
    attestation:     bytes      = field(default_factory=bytes)  # assinado pelo Circle
    arc_tx_hash:     str        = ""
    amount_usdc:     float      = 0.0
    recipient:       str        = ""
    error:           str        = ""


@dataclass
class BridgeResult:
    source_tx_hash: str
    arc_tx_hash:    str
    amount_usdc:    float
    recipient:      str
    message_hash:   str   = ""
    sandbox:        bool  = False


class CCTPClient:
    """
    Bridge USDC de qualquer chain EVM para o Arc via CCTP v2.

    Usa ArcNativeClient para o receiveMessage no Arc — o agente assina
    com sua própria chave Arc, sem depender da Circle W3S API.
    """

    def __init__(
        self,
        source_rpc:  str = "",
        arc_rpc:     str = "",
        signer_key:  str = "",    # chave que assina o burn na chain fonte
        arc_key:     str = "",    # chave Arc para receiveMessage (pode ser a mesma)
        sandbox:     bool = True,
    ):
        self.source_rpc = source_rpc or os.getenv("CCTP_SOURCE_RPC",         "")
        self.arc_rpc    = arc_rpc    or os.getenv("ARC_RPC_URL",             "")
        self.signer_key = signer_key or os.getenv("CCTP_SIGNER_PRIVATE_KEY", "")
        # chave Arc — fallback para ARC_AGENT_PRIVATE_KEY ou signer_key
        self.arc_key    = arc_key or os.getenv("ARC_AGENT_PRIVATE_KEY", "") or self.signer_key
        self.sandbox    = sandbox
        self._iris      = _IRIS_SANDBOX if sandbox else _IRIS_LIVE

        # Chain fonte
        self.src_usdc   = os.getenv("CCTP_SOURCE_USDC",            _SEPOLIA_USDC)
        self.src_tm     = os.getenv("CCTP_SOURCE_TOKEN_MESSENGER",  _SEPOLIA_TOKEN_MESSENGER)
        self.src_domain = int(os.getenv("CCTP_SOURCE_DOMAIN",      str(_CCTP_DOMAIN_ETHEREUM)))

        # Arc destino
        self.arc_mt     = os.getenv("ARC_CCTP_MSG_TRANSMITTER",    "")
        self.arc_domain = int(os.getenv("ARC_CCTP_DOMAIN",         "7"))
        self.arc_usdc   = os.getenv("ARC_CCTP_USDC",               "")

    # ------------------------------------------------------------------
    # Entry point principal
    # ------------------------------------------------------------------

    async def bridge_usdc_to_arc(
        self,
        amount_usdc: float,
        recipient:   str,
    ) -> BridgeResult:
        """
        Bridge completo Sepolia → Arc.
        recipient = endereço EVM no Arc que receberá o USDC.

        Retorna BridgeResult com ambos os tx hashes para o recibo PQC.
        """
        if self.sandbox:
            r = f"0xSANDBOX_{recipient[2:10] if recipient.startswith('0x') else recipient[:8]}"
            LOG.info("[cctp] SANDBOX bridge %.4f USDC → %s", amount_usdc, recipient)
            return BridgeResult(
                source_tx_hash=f"{r}_src",
                arc_tx_hash=f"{r}_arc",
                amount_usdc=amount_usdc,
                recipient=recipient,
                message_hash=f"0x{'0'*64}",
                sandbox=True,
            )

        self._require_web3()
        self._validate_config()

        state = BridgeState(amount_usdc=amount_usdc, recipient=recipient)

        try:
            # Passo 1+2: approve + depositForBurn
            state = await self._step_burn(state)

            # Passo 3: attestation Circle
            state = await self._step_attest(state)

            # Passo 4: receiveMessage no Arc
            state = await self._step_receive(state)

        except Exception as exc:
            state.error = str(exc)
            LOG.error(
                "[cctp] bridge failed at step=%s: %s",
                state.step.value, exc, exc_info=True,
            )
            raise RuntimeError(
                f"CCTP bridge falhou em step={state.step.value}: {exc}"
            ) from exc

        return BridgeResult(
            source_tx_hash=state.source_tx_hash,
            arc_tx_hash=state.arc_tx_hash,
            amount_usdc=state.amount_usdc,
            recipient=state.recipient,
            message_hash=state.message_hash,
            sandbox=False,
        )

    async def finalize_bridge(self, state: BridgeState) -> BridgeResult:
        """
        Retoma um bridge parcial a partir do BridgeState salvo.
        Útil quando o processo crasha depois do burn mas antes do receive.
        """
        if state.step == BridgeStep.BURNED:
            state = await self._step_attest(state)
        if state.step == BridgeStep.ATTESTED:
            state = await self._step_receive(state)

        return BridgeResult(
            source_tx_hash=state.source_tx_hash,
            arc_tx_hash=state.arc_tx_hash,
            amount_usdc=state.amount_usdc,
            recipient=state.recipient,
            message_hash=state.message_hash,
            sandbox=False,
        )

    # ------------------------------------------------------------------
    # Passo 1+2: approve + depositForBurn
    # ------------------------------------------------------------------

    async def _step_burn(self, state: BridgeState) -> BridgeState:
        from web3 import Web3
        from web3.middleware import ExtraDataToPOAMiddleware

        w3  = Web3(Web3.HTTPProvider(self.source_rpc, request_kwargs={"timeout": 30}))
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        acc = w3.eth.account.from_key(self.signer_key)

        usdc_contract = w3.eth.contract(
            address=Web3.to_checksum_address(self.src_usdc),
            abi=_USDC_ABI,
        )
        decimals  = usdc_contract.functions.decimals().call()
        amount_u  = int(state.amount_usdc * 10 ** decimals)
        chain_id  = w3.eth.chain_id

        # --- 1. approve (espera receipt antes do burn para evitar nonce race) ---
        nonce_0  = w3.eth.get_transaction_count(acc.address, "pending")
        approve_tx = usdc_contract.functions.approve(
            Web3.to_checksum_address(self.src_tm),
            amount_u,
        ).build_transaction({
            "from":    acc.address,
            "nonce":   nonce_0,
            "chainId": chain_id,
            "gasPrice": w3.eth.gas_price,
        })
        approve_tx["gas"] = w3.eth.estimate_gas(approve_tx)
        signed_a = acc.sign_transaction(approve_tx)
        approve_hash = w3.eth.send_raw_transaction(signed_a.raw_transaction).hex()
        LOG.info("[cctp] approve sent tx=%s", approve_hash)

        approve_receipt = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: w3.eth.wait_for_transaction_receipt(approve_hash, timeout=_TX_TIMEOUT_S),
        )
        if approve_receipt["status"] != 1:
            raise RuntimeError(f"[cctp] approve reverted: tx={approve_hash}")
        LOG.info("[cctp] approve confirmed block=%s", approve_receipt["blockNumber"])

        # --- 2. depositForBurn ---
        messenger = w3.eth.contract(
            address=Web3.to_checksum_address(self.src_tm),
            abi=_TOKEN_MESSENGER_ABI,
        )
        # mintRecipient: endereço Arc padded to bytes32 (big-endian, zero-padded)
        recipient_clean = state.recipient[2:] if state.recipient.startswith("0x") else state.recipient
        mint_recipient  = bytes.fromhex(recipient_clean.lower().zfill(64))

        nonce_1 = w3.eth.get_transaction_count(acc.address, "pending")
        burn_tx = messenger.functions.depositForBurn(
            amount_u,
            self.arc_domain,
            mint_recipient,
            Web3.to_checksum_address(self.src_usdc),
        ).build_transaction({
            "from":    acc.address,
            "nonce":   nonce_1,
            "chainId": chain_id,
            "gasPrice": w3.eth.gas_price,
        })
        burn_tx["gas"] = w3.eth.estimate_gas(burn_tx)
        signed_b    = acc.sign_transaction(burn_tx)
        burn_hash   = w3.eth.send_raw_transaction(signed_b.raw_transaction).hex()
        LOG.info("[cctp] depositForBurn sent tx=%s amount_u=%d", burn_hash, amount_u)

        burn_receipt = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: w3.eth.wait_for_transaction_receipt(burn_hash, timeout=_TX_TIMEOUT_S),
        )
        if burn_receipt["status"] != 1:
            raise RuntimeError(f"[cctp] depositForBurn reverted: tx={burn_hash}")

        # Extrair raw_message + message_hash do evento MessageSent
        raw_message, message_hash = self._extract_message_from_receipt(w3, burn_receipt)
        LOG.info("[cctp] burn confirmed tx=%s msg_hash=%s", burn_hash, message_hash)

        state.step           = BridgeStep.BURNED
        state.source_tx_hash = burn_hash
        state.raw_message    = raw_message
        state.message_hash   = message_hash
        return state

    # ------------------------------------------------------------------
    # Passo 3: attestation
    # ------------------------------------------------------------------

    async def _step_attest(self, state: BridgeState) -> BridgeState:
        state.step = BridgeStep.ATTESTING

        # Circle leva alguns segundos após o burn para indexar
        await asyncio.sleep(_ATTEST_INITIAL_WAIT_S)

        attestation_hex = await self._poll_attestation(state.message_hash)
        # hex → bytes (remove 0x prefix se presente)
        hex_clean       = attestation_hex[2:] if attestation_hex.startswith("0x") else attestation_hex
        state.attestation = bytes.fromhex(hex_clean)

        LOG.info(
            "[cctp] attestation received msg_hash=%s attest_len=%d",
            state.message_hash, len(state.attestation),
        )
        state.step = BridgeStep.ATTESTED
        return state

    async def _poll_attestation(self, message_hash: str) -> str:
        """Retorna o attestation hex quando Circle confirmar. Timeout 5 min."""
        url      = f"{self._iris}/{message_hash}"
        deadline = time.monotonic() + _ATTEST_TIMEOUT_S

        async with httpx.AsyncClient(timeout=15) as client:
            while time.monotonic() < deadline:
                try:
                    resp = await client.get(url)
                except httpx.RequestError as exc:
                    LOG.warning("[cctp] iris-api unreachable: %s — retrying", exc)
                    await asyncio.sleep(_ATTEST_INTERVAL_S)
                    continue

                if resp.status_code == 404:
                    LOG.debug("[cctp] attestation not indexed yet")
                    await asyncio.sleep(_ATTEST_INTERVAL_S)
                    continue

                if not resp.is_success:
                    LOG.warning("[cctp] iris-api %s: %s", resp.status_code, resp.text[:100])
                    await asyncio.sleep(_ATTEST_INTERVAL_S)
                    continue

                data   = resp.json()
                status = data.get("status")
                if status == "complete":
                    return data["attestation"]

                LOG.debug("[cctp] attestation status=%s", status)
                await asyncio.sleep(_ATTEST_INTERVAL_S)

        raise TimeoutError(
            f"[cctp] attestation não chegou em {_ATTEST_TIMEOUT_S:.0f}s | msg_hash={message_hash}"
        )

    # ------------------------------------------------------------------
    # Passo 4: receiveMessage no Arc
    # ------------------------------------------------------------------

    async def _step_receive(self, state: BridgeState) -> BridgeState:
        from server.integrations.arc_native import ArcNativeClient

        arc = ArcNativeClient(
            rpc_url=self.arc_rpc,
            private_key=self.arc_key,
            usdc_address=self.arc_usdc,
            sandbox=False,
        )

        if not self.arc_mt:
            raise RuntimeError(
                "[cctp] ARC_CCTP_MSG_TRANSMITTER não configurado — "
                "obtenha o endereço no Discord do hackathon Lepton"
            )

        result = await arc.receive_cctp_message(
            msg_transmitter=self.arc_mt,
            raw_message=state.raw_message,
            attestation=state.attestation,
        )

        state.step        = BridgeStep.RECEIVED
        state.arc_tx_hash = result.tx_hash
        LOG.info("[cctp] USDC minted on Arc tx=%s", state.arc_tx_hash)
        return state

    # ------------------------------------------------------------------
    # Extração do MessageSent
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_message_from_receipt(w3, receipt) -> tuple[bytes, str]:
        """
        Extrai raw_message e message_hash do evento MessageSent no receipt.

        MessageSent(bytes message) — o data é ABI-encoded como (bytes).
        message_hash = keccak256(raw_message) — usado para query da iris-api.

        NÃO retorna o hash como mensagem. raw_message e message_hash são
        coisas diferentes e não são intercambiáveis.
        """
        import eth_abi
        from web3 import Web3

        logs = receipt.get("logs", [])
        for log in logs:
            topics = log.get("topics", [])
            if not topics:
                continue

            t0 = topics[0]
            if isinstance(t0, bytes):
                topic_hex = "0x" + t0.hex()
            else:
                topic_hex = str(t0)
            if topic_hex.lower() != _MESSAGE_SENT_TOPIC.lower():
                continue

            # data do log = abi.encode(bytes message)
            raw_data = log["data"]
            if isinstance(raw_data, bytes):
                data_bytes = raw_data
            elif isinstance(raw_data, str):
                clean = raw_data[2:] if raw_data.startswith("0x") else raw_data
                data_bytes = bytes.fromhex(clean)
            else:
                continue

            # Decode ABI: (bytes) → raw_message
            (raw_message,) = eth_abi.decode(["bytes"], data_bytes)

            # keccak256(raw_message) = hash para a iris-api
            message_hash = Web3.keccak(raw_message).hex()

            return raw_message, message_hash

        raise RuntimeError(
            "[cctp] evento MessageSent não encontrado no receipt. "
            "Verifique se o endereço do TokenMessenger está correto."
        )

    # ------------------------------------------------------------------
    # Guards
    # ------------------------------------------------------------------

    @staticmethod
    def _require_web3() -> None:
        try:
            import web3       # noqa
            import eth_abi    # noqa
        except ImportError:
            raise RuntimeError(
                "Dependências EVM não instaladas.\n"
                "Rode: pip install web3>=6.20.0\n"
                "Ou desative com CCTP_ENABLED=false."
            )

    def _validate_config(self) -> None:
        missing = []
        if not self.source_rpc:   missing.append("CCTP_SOURCE_RPC")
        if not self.arc_rpc:      missing.append("ARC_RPC_URL")
        if not self.signer_key:   missing.append("CCTP_SIGNER_PRIVATE_KEY")
        if not self.arc_key:      missing.append("ARC_AGENT_PRIVATE_KEY")
        if missing:
            raise RuntimeError(
                f"[cctp] variáveis faltando: {', '.join(missing)}"
            )
