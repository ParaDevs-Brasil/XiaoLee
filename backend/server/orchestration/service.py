from __future__ import annotations

import re
from typing import Any, Dict, Optional

from server.integrations.gemini_client import GeminiClient
from server.integrations.solana_client import SolanaClient
from server.integrations.stellar_adapter import StellarAdapter
from server.schemas import IntentResponse

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"

_PLATFORM_CONTEXT = (
    "You are the AI core of the XiaoLee platform — a DeFi conversational interface "
    "supporting both Solana and Stellar networks. "
    "XiaoLee lets users participate in creator campaigns and earn $XLEE tokens by completing "
    "social tasks (following accounts, engaging with tweets, retweeting). "
    "On Stellar, you can check XLM/USDC balances, fetch swap quotes via Stellar DEX (path payments), "
    "and handle campaigns with on-chain reward distribution via Soroban. "
    "On Solana, you can check balances on Devnet and fetch swap quotes via Jupiter. "
    "Be proactive: if the user has a connected wallet, offer to check their balance or suggest campaigns. "
    "Respond in the same language the user writes in (PT-BR or EN). "
    "Never execute transactions without explicit user confirmation."
)

_STELLAR_CONTEXT = (
    "Chain ativa: Stellar Testnet. "
    "Operações disponíveis: consultar saldo XLM/USDC, swap via Stellar DEX, "
    "participar de campanhas com recompensa $XLEE, pagamentos peer-to-peer. "
    "Apresente sempre o quote antes de executar qualquer swap. "
    "Responda em PT-BR."
)


class OrchestrationService:
    def __init__(self, gemini: GeminiClient, solana: SolanaClient, stellar: Optional[StellarAdapter] = None):
        self.gemini = gemini
        self.solana = solana
        self.stellar = stellar

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _extract_wallet_from_note(self, text: str) -> str | None:
        """Pull the wallet address out of the [System Note: ...] injected by /chat."""
        match = re.search(
            r"\[System Note: User connected wallet is ([1-9A-HJ-NP-Za-km-z]{32,44})\]",
            text,
        )
        return match.group(1) if match else None

    def _extract_stellar_wallet_from_note(self, text: str) -> str | None:
        """Pull the Stellar G... wallet from [System Note: Stellar wallet G...]"""
        match = re.search(r"\[System Note: Stellar wallet (G[A-Z0-9]{55})\]", text)
        return match.group(1) if match else None

    def _is_stellar_context(self, text: str) -> bool:
        """Detect if the message refers to Stellar chain."""
        lowered = text.lower()
        stellar_keywords = ("stellar", "xlm", "freighter", "soroban", "lumens", "brla", "sep-10", "sep10")
        # Also check for Stellar public key format G... (56 chars)
        has_stellar_wallet = bool(re.search(r"\bG[A-Z0-9]{55}\b", text))
        return any(k in lowered for k in stellar_keywords) or has_stellar_wallet

    def _clean_text(self, text: str) -> str:
        """Remove all [System Note: ...] tags so only the human message reaches Gemini."""
        return re.sub(r"\[System Note:[^\]]+\]\s*", "", text).strip()

    def _wallet_ctx(self, wallet: str | None, platform: str = "web") -> str:
        if wallet:
            return (
                f"The user has wallet {wallet} connected on Solana Devnet. "
                "Use this address whenever they ask about their balance or want to swap."
            )
        if platform in ("telegram", "x"):
            return (
                "The user has not connected a wallet yet. "
                "This is a chat-only interface — there is no connect button. "
                "Ask them to send their Solana wallet address directly in this chat."
            )
        return (
            "The user has not connected a wallet yet. "
            "If they ask about balances or swaps, warmly invite them to connect their Phantom wallet."
        )

    def _extract_wallet(self, text: str) -> str | None:
        pattern = r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b"
        match = re.search(pattern, text)
        return match.group(0) if match else None

    def _extract_amount(self, text: str) -> float | None:
        match = re.search(r"(\d+(?:[\.,]\d+)?)", text)
        if not match:
            return None
        return float(match.group(1).replace(",", "."))

    # ------------------------------------------------------------------
    # Intent detection
    # ------------------------------------------------------------------

    async def detect_intent(self, text: str, user_id: str, history: list = None) -> IntentResponse:
        clean = self._clean_text(text)
        ai_intent = await self.gemini.classify_intent(clean, history=history)
        if ai_intent.get("confidence", 0.0) >= 0.65:
            return IntentResponse(**{
                "action": ai_intent["action"],
                "confidence": ai_intent["confidence"],
                "entities": ai_intent["entities"],
            })

        lowered = clean.lower()

        # Stellar-specific intent detection
        if any(w in lowered for w in ("xlm", "lumens", "stellar", "freighter", "soroban")):
            if any(w in lowered for w in ("saldo", "balance", "quanto tenho", "my balance")):
                wallet = re.search(r"\bG[A-Z0-9]{55}\b", clean)
                return IntentResponse(
                    action="stellar_balance",
                    confidence=0.85,
                    entities={"wallet": wallet.group(0) if wallet else None},
                )
            if any(w in lowered for w in ("swap", "trocar", "exchange", "quote", "cotação")):
                amount = self._extract_amount(clean) or 10.0
                from_asset = "XLM" if "xlm" in lowered else "USDC"
                to_asset = "USDC" if from_asset == "XLM" else "XLM"
                return IntentResponse(
                    action="stellar_swap",
                    confidence=0.85,
                    entities={"amount": amount, "from": from_asset, "to": to_asset},
                )

        if any(w in lowered for w in ("saldo", "balance", "quanto tenho", "meus tokens", "my balance")):
            wallet = self._extract_wallet(clean)
            return IntentResponse(action="check_balance", confidence=0.75, entities={"wallet": wallet})

        if any(w in lowered for w in ("quote", "cotação", "cotacao", "swap", "trocar", "exchange")):
            amount = self._extract_amount(clean) or 1.0
            return IntentResponse(action="swap_quote", confidence=0.75, entities={"amount": amount, "from": "USDC", "to": "SOL"})

        if any(w in lowered for w in ("campaign", "campanha", "xlee", "$xlee", "reward", "recompensa", "tarefa")):
            return IntentResponse(action="campaign_info", confidence=0.70, entities={})

        if any(w in lowered for w in ("oi", "olá", "hello", "hi", "hey", "ola", "bom dia", "boa tarde", "boa noite")):
            return IntentResponse(action="greeting", confidence=0.75, entities={})

        return IntentResponse(action="help", confidence=0.5, entities={})

    # ------------------------------------------------------------------
    # Main execution
    # ------------------------------------------------------------------

    async def execute(self, text: str, user_id: str, history: list = None, platform: str = "web") -> Dict[str, Any]:
        wallet_address = self._extract_wallet_from_note(text)
        stellar_wallet = self._extract_stellar_wallet_from_note(text)
        clean_text = self._clean_text(text)
        use_stellar = self.stellar is not None and (
            stellar_wallet is not None or self._is_stellar_context(clean_text)
        )

        # If user typed a wallet address inline (e.g. on Telegram/X), treat as check_balance.
        inline_wallet = self._extract_wallet(clean_text) if not wallet_address else None
        if inline_wallet:
            wallet_address = inline_wallet

        wallet_ctx = self._wallet_ctx(wallet_address, platform=platform)
        intent = await self.detect_intent(text, user_id, history=history)

        # Override: if a wallet was found inline, always check balance.
        if inline_wallet and intent.action not in ("check_balance",):
            from server.schemas import IntentResponse as _IR
            intent = _IR(action="check_balance", confidence=0.90, entities={"wallet": inline_wallet})

        # --- stellar_balance ---
        if intent.action in ("check_balance", "stellar_balance") and use_stellar:
            wallet = stellar_wallet or intent.entities.get("wallet")
            if not wallet:
                instruction = (
                    f"{_PLATFORM_CONTEXT} {_STELLAR_CONTEXT} "
                    "O usuário quer saber o saldo mas não conectou a carteira Freighter ainda. "
                    "Peça que conecte a carteira Freighter para consultar o saldo Stellar."
                )
                reply = await self.gemini.generate_reply(
                    instruction=instruction, user_text=clean_text, history=history
                )
                return {"intent": intent, "reply_text": reply, "execution": {"status": "missing_stellar_wallet"}}
            try:
                balance = await self.stellar.get_balance(wallet)
                assets_str = ", ".join(
                    f"{a['balance']:.2f} {a['asset_code']}" for a in balance.assets
                ) if balance.assets else "nenhum asset adicional"
                instruction = (
                    f"{_PLATFORM_CONTEXT} {_STELLAR_CONTEXT} "
                    f"Saldo Stellar do usuário — Wallet: {wallet} | "
                    f"XLM: {balance.xlm:.4f} | Assets: {assets_str}. "
                    "Apresente o saldo de forma clara e animada. "
                    "Se o saldo de XLM for baixo, sugira participar de campanhas para ganhar $XLEE."
                )
                reply = await self.gemini.generate_reply(
                    instruction=instruction, user_text=clean_text, history=history
                )
                return {
                    "intent": intent,
                    "reply_text": reply,
                    "execution": {
                        "chain": "stellar",
                        "wallet": wallet,
                        "xlm": balance.xlm,
                        "assets": balance.assets,
                        "network": balance.network,
                    },
                }
            except Exception as exc:
                instruction = (
                    f"{_PLATFORM_CONTEXT} {_STELLAR_CONTEXT} "
                    f"Erro ao consultar saldo Stellar para {wallet}: {exc}. "
                    "Peça desculpas e oriente o usuário a verificar a conexão."
                )
                reply = await self.gemini.generate_reply(
                    instruction=instruction, user_text=clean_text, history=history
                )
                return {"intent": intent, "reply_text": reply, "execution": {"status": "stellar_rpc_error"}}

        # --- stellar_swap ---
        if intent.action in ("swap_quote", "stellar_swap") and use_stellar:
            amount = float(intent.entities.get("amount", 10.0))
            from_asset = intent.entities.get("from", "XLM")
            to_asset = intent.entities.get("to", "USDC")
            wallet = stellar_wallet or ""
            swap_xdr: Optional[str] = None
            try:
                quote = await self.stellar.prepare_swap(
                    wallet=wallet,  # vazio → find_payment_paths usa source_assets=native
                    from_asset=from_asset,
                    to_asset=to_asset,
                    amount=amount,
                )
                if quote.destination_amount > 0:
                    # Constrói XDR assinável para o frontend executar via Freighter
                    if wallet:
                        try:
                            swap_xdr = await self.stellar.build_swap_xdr(
                                wallet=wallet,
                                from_asset=from_asset,
                                to_asset=to_asset,
                                send_amount=quote.source_amount,
                                min_dest_amount=quote.destination_amount * 0.99,
                            )
                        except Exception as xdr_err:
                            import logging
                            logging.getLogger(__name__).warning("build_swap_xdr falhou: %s", xdr_err)
                    instruction = (
                        f"{_PLATFORM_CONTEXT} {_STELLAR_CONTEXT} "
                        f"Quote Stellar DEX encontrado: {quote.source_amount} {from_asset} → "
                        f"~{quote.destination_amount:.4f} {to_asset}. "
                        f"Fee: {quote.fee_xlm} XLM. "
                        "A transação foi preparada e está pronta para assinatura no Freighter. "
                        "Informe o usuário do quote e diga que é só clicar em 'Assinar no Freighter' para executar. "
                        "Seja animada e objetiva — a XiaoLee JÁ preparou tudo."
                    )
                else:
                    instruction = (
                        f"{_PLATFORM_CONTEXT} {_STELLAR_CONTEXT} "
                        f"Não foi encontrado path de liquidez para {from_asset} → {to_asset} no Stellar DEX testnet agora. "
                        "Explique honestamente. Sugira tentar XLM → BRLA ou verificar mais tarde."
                    )
            except Exception as exc:
                instruction = (
                    f"{_PLATFORM_CONTEXT} {_STELLAR_CONTEXT} "
                    f"Erro ao buscar quote Stellar DEX: {exc}. Peça desculpas brevemente."
                )
                quote = None
            reply = await self.gemini.generate_reply(
                instruction=instruction, user_text=clean_text, history=history
            )
            return {
                "intent": intent,
                "reply_text": reply,
                "execution": {
                    "chain": "stellar",
                    "swap_quote": {
                        "from": from_asset,
                        "to": to_asset,
                        "source_amount": quote.source_amount if quote else 0,
                        "destination_amount": quote.destination_amount if quote else 0,
                    } if quote else {},
                    "swap_xdr": swap_xdr,
                    "network_passphrase": "Test SDF Network ; September 2015",
                },
            }

        # --- check_balance ---
        if intent.action == "check_balance":
            wallet = intent.entities.get("wallet") or wallet_address or self._extract_wallet(clean_text)
            if not wallet and user_id.startswith("devnet_wallet_"):
                wallet = user_id.replace("devnet_wallet_", "")
            elif not wallet and len(user_id) >= 32 and user_id.replace("-", "").isalnum():
                wallet = user_id

            if not wallet:
                instruction = (
                    f"{_PLATFORM_CONTEXT} "
                    f"{wallet_ctx} "
                    "The user asked for their balance but no wallet is connected. "
                    "Ask them to connect their Phantom wallet first."
                )
                reply = await self.gemini.generate_reply(
                    instruction=instruction, user_text=clean_text, history=history
                )
                return {"intent": intent, "reply_text": reply, "execution": {"status": "missing_wallet"}}

            try:
                balance = await self.solana.get_balance(wallet)
                sol_amount = balance.get("sol", 0)
                instruction = (
                    f"{_PLATFORM_CONTEXT} "
                    f"The user just checked their wallet balance. "
                    f"Wallet: {wallet} — Balance: {sol_amount:.6f} SOL. "
                    "Present this clearly and cheerfully. If the balance is low, "
                    "suggest they could earn $XLEE tokens through campaigns."
                )
                reply = await self.gemini.generate_reply(
                    instruction=instruction, user_text=clean_text, history=history
                )
                return {"intent": intent, "reply_text": reply, "execution": balance}
            except Exception as e:
                instruction = (
                    f"{_PLATFORM_CONTEXT} {wallet_ctx} "
                    f"There was an error fetching the balance for wallet {wallet}: {e}. "
                    "Apologize warmly and ask them to try again."
                )
                reply = await self.gemini.generate_reply(
                    instruction=instruction, user_text=clean_text, history=history
                )
                return {"intent": intent, "reply_text": reply, "execution": {"status": "rpc_error"}}

        # --- swap_quote ---
        if intent.action == "swap_quote":
            amount = float(intent.entities.get("amount", 1.0))
            amount_raw = int(amount * 1_000_000)
            try:
                quote = await self.solana.get_swap_quote(
                    input_mint=USDC_DEVNET_MINT,
                    output_mint=SOL_MINT,
                    amount_raw=amount_raw,
                )
                out_raw = int(quote.get("outAmount", 0))
                out_sol = out_raw / 1_000_000_000
                instruction = (
                    f"{_PLATFORM_CONTEXT} {wallet_ctx} "
                    f"Jupiter quote: {amount} USDC → {out_sol:.6f} SOL. "
                    "Present this in a fun way and ask if they want to proceed with the swap."
                )
            except Exception:
                quote = {}
                instruction = (
                    f"{_PLATFORM_CONTEXT} {wallet_ctx} "
                    "Jupiter swap API is temporarily unavailable. "
                    "Apologize and suggest trying again in a moment."
                )
            reply = await self.gemini.generate_reply(
                instruction=instruction, user_text=clean_text, history=history
            )
            return {"intent": intent, "reply_text": reply, "execution": quote}

        # --- campaign_info ---
        if intent.action == "campaign_info":
            instruction = (
                f"{_PLATFORM_CONTEXT} {wallet_ctx} "
                "The user is asking about campaigns or $XLEE tokens. "
                "Explain how campaigns work on XiaoLee: projects create campaigns, users join them, "
                "complete social tasks (follow, reply, retweet), and earn $XLEE tokens as rewards. "
                "Be enthusiastic — this is the core of the platform!"
            )
            reply = await self.gemini.generate_reply(
                instruction=instruction, user_text=clean_text, history=history
            )
            return {"intent": intent, "reply_text": reply, "execution": {"status": "info"}}

        # --- greeting ---
        if intent.action == "greeting":
            wallet_greeting = (
                f"The user has wallet {wallet_address} connected."
                if wallet_address
                else "The user hasn't connected a wallet yet."
            )
            instruction = (
                f"{_PLATFORM_CONTEXT} "
                f"{wallet_greeting} "
                "The user is greeting you. Welcome them warmly with your full XiaoLee personality. "
                "Briefly mention 1-2 things you can help with (balance, swap quotes, campaigns). "
                "Keep it short and inviting — 2 to 3 sentences max."
            )
            reply = await self.gemini.generate_reply(
                instruction=instruction, user_text=clean_text, history=history
            )
            return {"intent": intent, "reply_text": reply, "execution": {"status": "greeting"}}

        # --- help / general fallback ---
        instruction = (
            f"{_PLATFORM_CONTEXT} {wallet_ctx} "
            "Answer the user's question naturally. If it's about Solana, DeFi, XiaoLee, "
            "campaigns, or crypto in general — be helpful and accurate. "
            "If it's completely off-topic, gently redirect to what you can help with."
        )
        reply = await self.gemini.generate_reply(
            instruction=instruction, user_text=clean_text, history=history
        )
        return {"intent": intent, "reply_text": reply, "execution": {"status": "info"}}
