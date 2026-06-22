from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

from server.integrations.gemini_client import GeminiClient
from server.integrations.solana_client import SolanaClient
from server.integrations.stellar_adapter import StellarAdapter
from server.schemas import IntentResponse

logger = logging.getLogger(__name__)

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"

_PLATFORM_CONTEXT = (
    "You are XiaoLee — a conversational AI layer for DeFi on Stellar. "
    "You help users interact with the Stellar network via natural language: "
    "check XLM/USDC balances, swap via Stellar DEX (path payments), deposit via SEP-24 anchors, "
    "pay for AI queries using the x402 protocol, and participate in creator campaigns to earn $XLEE tokens. "
    "Authentication is non-custodial via SEP-10 + Freighter wallet — private keys never touch the backend. "
    "Be proactive: if the user has a Freighter wallet connected, offer to check their balance or suggest campaigns. "
    "Respond in the same language the user writes in (PT-BR or EN). "
    "Never execute transactions without explicit user confirmation."
)

_STELLAR_CONTEXT = (
    "Chain ativa: Stellar Testnet. "
    "Carteira: Freighter (não-custodial, autenticada via SEP-10). "
    "Operações disponíveis: consultar saldo XLM/USDC, swap via Stellar DEX (path payments), "
    "depositar via âncora SEP-24 (testanchor.stellar.org), micropagamentos AI via x402, "
    "participar de campanhas com recompensa $XLEE. "
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
                f"The user has Solana wallet {wallet} connected. "
                "Use this address whenever they ask about their Solana balance."
            )
        if platform in ("telegram", "x"):
            return (
                "The user has not connected a wallet yet. "
                "This is a chat-only interface. "
                "Ask them to share their Stellar address (starts with G) or connect Freighter on the web app."
            )
        return (
            "The user has not connected a wallet yet. "
            "Warmly invite them to connect their Freighter wallet to access Stellar DeFi features: "
            "balance, swap, anchor deposit, and AI micropayments via x402."
        )

    def _stellar_wallet_ctx(self, wallet: str | None) -> str:
        if wallet:
            return (
                f"Stellar wallet conectada: {wallet} (autenticada via SEP-10, Freighter). "
                "Use este endereço para consultas de saldo, swaps e operações Stellar."
            )
        return (
            "Nenhuma Stellar wallet conectada ainda. "
            "Convide o usuário a conectar o Freighter para acessar: saldo XLM/USDC, "
            "swap via Stellar DEX, depósito via âncora SEP-24 e AI queries via x402."
        )

    def _extract_wallet(self, text: str) -> str | None:
        pattern = r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b"
        match = re.search(pattern, text)
        return match.group(0) if match else None

    def _extract_amount(self, text: str) -> float | None:
        # Prefer monetary patterns: "100 USDC", "$50", "5 SOL", "10.5 XLM"
        monetary = re.search(
            r"(\d+(?:[.,]\d+)?)\s*(?:usdc|sol|xlm|usd|\$|reais|brl)",
            text, re.IGNORECASE
        )
        if monetary:
            return float(monetary.group(1).replace(",", "."))
        # Fallback: first standalone number (not preceded by # - /)
        plain = re.search(r"(?<![\#\/\-])\b(\d{1,10}(?:[.,]\d{1,8})?)\b(?![\-\/\#])", text)
        if plain:
            return float(plain.group(1).replace(",", "."))
        return None

    _NEGATION_RE = re.compile(
        r"\b(não|nao|no|not|nunca|never|cancel|cancelar|cancela|sem|without)\b",
        re.IGNORECASE,
    )
    _SWAP_QUESTION_RE = re.compile(
        r"\b(o que é|what is|como funciona|how does|me explica|explain|o que sao|what are)\b",
        re.IGNORECASE,
    )
    _SWAP_ACTION_RE = re.compile(
        r"\b(quero|queria|faz|faça|make|execute|converter|convert|trocar|troca|swap now)\b",
        re.IGNORECASE,
    )

    def _has_negation(self, text: str) -> bool:
        return bool(self._NEGATION_RE.search(text))

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
            # #14 — não disparar swap se for pergunta educacional ("o que é swap")
            # #15 — não disparar swap se houver negação ("não quero swap")
            is_question = bool(self._SWAP_QUESTION_RE.search(clean))
            has_action = bool(self._SWAP_ACTION_RE.search(clean))
            if not is_question or has_action:
                if not self._has_negation(clean):
                    amount = self._extract_amount(clean) or 1.0
                    return IntentResponse(action="swap_quote", confidence=0.75, entities={"amount": amount, "from": "USDC", "to": "SOL"})

        if any(w in lowered for w in ("campaign", "campanha", "xlee", "$xlee", "reward", "recompensa", "tarefa")):
            return IntentResponse(action="campaign_info", confidence=0.70, entities={})

        if any(w in lowered for w in ("oi", "olá", "hello", "hi", "hey", "ola", "bom dia", "boa tarde", "boa noite")):
            return IntentResponse(action="greeting", confidence=0.75, entities={})

        # --- intents do agente Arc (sprint Lepton) ---
        _arc_run_kw = (
            "run campaign", "executar campanha", "disparar agente",
            "start campaign", "iniciar campanha", "rodar agente",
        )
        _arc_pay_kw = (
            "pay creator", "pagar creator", "nanopayment",
            "usdc creator", "pagar usdc",
        )
        _arc_discover_kw = (
            "discover creators", "buscar creators", "find creators",
            "encontrar creators", "listar creators",
        )
        _arc_budget_kw = (
            "check budget", "verificar budget", "saldo usdc",
            "quanto tenho usdc", "arc balance",
        )

        if any(w in lowered for w in _arc_run_kw):
            campaign_id = self._extract_amount(clean)
            return IntentResponse(
                action="run_campaign_agent",
                confidence=0.85,
                entities={"campaign_id": int(campaign_id) if campaign_id else None},
            )

        if any(w in lowered for w in _arc_pay_kw):
            return IntentResponse(action="pay_creator", confidence=0.80, entities={})

        if any(w in lowered for w in _arc_discover_kw):
            return IntentResponse(action="discover_creators", confidence=0.80, entities={})

        if any(w in lowered for w in _arc_budget_kw):
            return IntentResponse(action="check_budget", confidence=0.80, entities={})

        # --- intent miss logging (#17) ---
        logger.warning(
            "intent_miss user=%s confidence=%.2f gemini_action=%s text_preview=%s",
            user_id,
            ai_intent.get("confidence", 0.0),
            ai_intent.get("action", "none"),
            clean[:80],
        )
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
        if intent.action in ("swap_quote", "stellar_swap", "swap_execute", "swap") and use_stellar:
            amount = float(intent.entities.get("amount", 10.0))
            e = intent.entities
            from_asset = (e.get("from") or e.get("from_asset") or e.get("from_token") or e.get("source_asset", "XLM"))
            to_asset = (e.get("to") or e.get("to_asset") or e.get("to_token") or e.get("destination_asset", "USDC"))
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

        # --- check_balance (sem contexto Stellar → orienta Freighter) ---
        if intent.action == "check_balance":
            stellar_ctx = self._stellar_wallet_ctx(None)
            instruction = (
                f"{_PLATFORM_CONTEXT} {stellar_ctx} "
                "O usuário perguntou sobre saldo mas não há carteira Stellar conectada no contexto. "
                "Oriente a conectar o Freighter na Stellar Wallet para consultar XLM/USDC. "
                "Mencione brevemente que também é possível fazer swap e depósito via âncora."
            )
            reply = await self.gemini.generate_reply(
                instruction=instruction, user_text=clean_text, history=history
            )
            return {"intent": intent, "reply_text": reply, "execution": {"status": "missing_stellar_wallet"}}

        # --- swap_quote (sem contexto Stellar → orienta Stellar DEX) ---
        if intent.action == "swap_quote":
            stellar_ctx = self._stellar_wallet_ctx(None)
            instruction = (
                f"{_PLATFORM_CONTEXT} {stellar_ctx} "
                "O usuário quer fazer um swap. "
                "Explique que na XiaoLee os swaps são via Stellar DEX (path payments, sem gas alto). "
                "Oriente a conectar o Freighter e usar a seção 'Swap · Stellar DEX' na Stellar Wallet. "
                "Mencione que XLM ↔ USDC está disponível diretamente."
            )
            reply = await self.gemini.generate_reply(
                instruction=instruction, user_text=clean_text, history=history
            )
            return {"intent": intent, "reply_text": reply, "execution": {"status": "redirect_stellar_dex"}}

        # --- run_campaign_agent / discover_creators / pay_creator ---
        if intent.action in ("run_campaign_agent", "discover_creators", "pay_creator", "check_budget"):
            campaign_id = intent.entities.get("campaign_id")
            if intent.action == "run_campaign_agent" and campaign_id:
                instruction = (
                    f"{_PLATFORM_CONTEXT} "
                    f"O usuário quer disparar o agente de campanha para a campanha #{campaign_id}. "
                    "Informe que o agente autônomo XiaoLee vai descobrir creators elegíveis, avaliá-los "
                    "e pagar os melhores em USDC via Arc/Circle. "
                    "Diga que pode fazer isso via API: POST /v1/agent/run-campaign. "
                    "Seja animada e direta — máximo 2 frases."
                )
            else:
                instruction = (
                    f"{_PLATFORM_CONTEXT} "
                    "O usuário está interagindo com o sistema de agente Arc. "
                    f"Ação solicitada: {intent.action}. "
                    "Explique brevemente as capacidades do agente: descoberta de creators, avaliação e pagamento USDC. "
                    "Oriente a usar a API /v1/agent/run-campaign para disparar o loop autônomo."
                )
            reply = await self.gemini.generate_reply(
                instruction=instruction, user_text=clean_text, history=history
            )
            return {
                "intent": intent,
                "reply_text": reply,
                "execution": {"status": "arc_agent", "campaign_id": campaign_id},
            }

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
            stellar_greeting = (
                f"O usuário tem a Stellar wallet {stellar_wallet} conectada via Freighter."
                if stellar_wallet
                else "O usuário ainda não conectou a carteira Freighter."
            )
            instruction = (
                f"{_PLATFORM_CONTEXT} "
                f"{stellar_greeting} "
                "O usuário está te cumprimentando. Dê as boas-vindas com a personalidade completa da XiaoLee. "
                "Mencione brevemente 1-2 coisas que você pode fazer: saldo Stellar, swap via DEX, "
                "depósito via âncora SEP-24, ou ganhar $XLEE em campanhas. "
                "Seja calorosa, concisa — máximo 2 a 3 frases."
            )
            reply = await self.gemini.generate_reply(
                instruction=instruction, user_text=clean_text, history=history
            )
            return {"intent": intent, "reply_text": reply, "execution": {"status": "greeting"}}

        # --- help / general fallback ---
        stellar_ctx = self._stellar_wallet_ctx(stellar_wallet)
        instruction = (
            f"{_PLATFORM_CONTEXT} {stellar_ctx} "
            "Responda a pergunta do usuário de forma natural. "
            "Se for sobre Stellar, DeFi, XiaoLee, campanhas, Freighter, SEP-10, SEP-24, x402 ou crypto em geral "
            "— seja precisa e útil. "
            "Se for completamente fora do tema, redirecione gentilmente para o que você pode ajudar."
        )
        reply = await self.gemini.generate_reply(
            instruction=instruction, user_text=clean_text, history=history
        )
        return {"intent": intent, "reply_text": reply, "execution": {"status": "info"}}
