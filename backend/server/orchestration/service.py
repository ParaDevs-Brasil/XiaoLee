from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Optional

from server.integrations.gemini_client import GeminiClient
from server.integrations.solana_client import SolanaClient
from server.integrations.stellar_adapter import StellarAdapter
from server.schemas import IntentResponse
from server.settings import settings

logger = logging.getLogger(__name__)

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
STELLAR_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"

# Tools exposed to Claude in the agentic path (OpenAI function format — the
# ClaudeAgentEngine converts them to Anthropic input_schema). The wallet is NOT
# a parameter: it comes from the connected Freighter wallet and is injected by
# the executor, so Claude can't operate on an arbitrary address.
STELLAR_AGENT_TOOLS = [
    {"type": "function", "function": {
        "name": "stellar_get_balance",
        "description": (
            "Consulta o saldo da carteira Stellar conectada do usuário (XLM e assets como USDC). "
            "Use quando o usuário perguntar sobre saldo / quanto tem / balance."
        ),
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "stellar_swap_quote",
        "description": (
            "Gera uma cotação de swap no Stellar DEX (path payment) e prepara a transação para o "
            "usuário assinar no Freighter. Use quando o usuário quiser trocar/swap entre ativos "
            "(ex: XLM↔USDC). Sempre apresente o quote ao usuário; a XiaoLee NÃO executa o swap — "
            "quem assina é o usuário no Freighter."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "from_asset": {"type": "string", "description": "Ativo de origem, ex: XLM ou USDC"},
                "to_asset": {"type": "string", "description": "Ativo de destino, ex: USDC ou XLM"},
                "amount": {"type": "number", "description": "Quantidade do ativo de origem a trocar"},
            },
            "required": ["from_asset", "to_asset", "amount"],
        },
    }},
]

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

        # Claude agentic engine — active only when LLM_PROVIDER=anthropic + key set.
        # When on, execute() routes through the multi-step tool-use loop and the
        # legacy Gemini intent state machine below becomes the fallback.
        self.claude_engine = None
        if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
            try:
                import anthropic
                from claude_agent import ClaudeAgentEngine
                self._anthropic = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
                self.claude_engine = ClaudeAgentEngine(self._anthropic, settings.anthropic_model)
                logger.info("🤖 [AGENTIC] OrchestrationService running on Claude — model=%s", settings.anthropic_model)
            except Exception as exc:
                logger.warning("Claude engine init failed, staying on Gemini path: %s", exc)

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
    # Agentic execution (Claude)
    # ------------------------------------------------------------------

    def _build_agentic_system_prompt(self, stellar_wallet: str | None, platform: str) -> str:
        wallet_ctx = self._stellar_wallet_ctx(stellar_wallet)
        return (
            f"{_PLATFORM_CONTEXT}\n{_STELLAR_CONTEXT}\n{wallet_ctx}\n\n"
            "FERRAMENTAS DISPONÍVEIS:\n"
            "- stellar_get_balance: chame quando o usuário perguntar sobre o saldo dele (XLM/USDC).\n"
            "- stellar_swap_quote: chame quando o usuário quiser trocar/swap ativos (ex: XLM↔USDC). "
            "Ela gera o quote e prepara a transação para o Freighter. Apresente o quote e diga que é só "
            "assinar no Freighter — você NÃO executa o swap sozinha.\n\n"
            "Para saudações, dúvidas sobre campanhas/$XLEE, SEP-24, x402 ou crypto em geral, responda "
            "direto com sua personalidade, sem ferramentas. Se uma operação exigir carteira e ela não "
            "estiver conectada, peça gentilmente para conectar o Freighter. Responda SEMPRE no idioma do usuário."
        )

    def _make_stellar_executor(self, stellar_wallet: str | None, captured: Dict[str, Any]):
        """Build the tool executor closure for the agentic loop.

        Executes the real Stellar operations and captures the structured
        ``execution`` payload (incl. ``swap_xdr`` for Freighter signing) so the
        /chat response keeps its existing shape for the frontend.
        """
        async def executor(tool_name: str, tool_input: Dict[str, Any]) -> str:
            if tool_name == "stellar_get_balance":
                if not stellar_wallet:
                    return json.dumps({"error": "no_wallet",
                                       "message": "Nenhuma carteira Freighter conectada. Peça ao usuário para conectar."})
                balance = await self.stellar.get_balance(stellar_wallet)
                captured["actions"].append("stellar_balance")
                captured["execution"] = {
                    "chain": "stellar", "wallet": stellar_wallet,
                    "xlm": balance.xlm, "assets": balance.assets, "network": balance.network,
                }
                return json.dumps({
                    "wallet": stellar_wallet, "xlm": balance.xlm,
                    "assets": [{"asset_code": a.get("asset_code"), "balance": a.get("balance")} for a in balance.assets],
                    "network": balance.network,
                })

            if tool_name == "stellar_swap_quote":
                from_asset = str(tool_input.get("from_asset", "XLM"))
                to_asset = str(tool_input.get("to_asset", "USDC"))
                amount = float(tool_input.get("amount", 10.0))
                captured["last_swap_args"] = {"from": from_asset, "to": to_asset, "amount": amount}
                quote = await self.stellar.prepare_swap(
                    wallet=stellar_wallet or "", from_asset=from_asset, to_asset=to_asset, amount=amount,
                )
                swap_xdr = None
                if quote.destination_amount > 0 and stellar_wallet:
                    try:
                        swap_xdr = await self.stellar.build_swap_xdr(
                            wallet=stellar_wallet, from_asset=from_asset, to_asset=to_asset,
                            send_amount=quote.source_amount, min_dest_amount=quote.destination_amount * 0.99,
                        )
                    except Exception as xdr_err:
                        logger.warning("build_swap_xdr falhou: %s", xdr_err)
                captured["actions"].append("stellar_swap")
                captured["execution"] = {
                    "chain": "stellar",
                    "swap_quote": {
                        "from": from_asset, "to": to_asset,
                        "source_amount": quote.source_amount, "destination_amount": quote.destination_amount,
                    },
                    "swap_xdr": swap_xdr,
                    "network_passphrase": STELLAR_NETWORK_PASSPHRASE,
                }
                if quote.destination_amount <= 0:
                    return json.dumps({"no_path": True, "from": from_asset, "to": to_asset,
                                       "message": "Sem path de liquidez no Stellar DEX testnet agora."})
                return json.dumps({
                    "from": from_asset, "to": to_asset,
                    "source_amount": quote.source_amount, "destination_amount": quote.destination_amount,
                    "fee_xlm": quote.fee_xlm, "ready_to_sign": bool(swap_xdr),
                })

            return json.dumps({"error": "unknown_tool", "tool": tool_name})

        return executor

    def _synthesize_intent(self, captured: Dict[str, Any], stellar_wallet: str | None) -> IntentResponse:
        """Reconstruct an IntentResponse from the tools Claude actually called."""
        actions = captured.get("actions", [])
        if "stellar_swap" in actions:
            return IntentResponse(action="stellar_swap", confidence=0.9,
                                  entities=captured.get("last_swap_args", {}))
        if "stellar_balance" in actions:
            return IntentResponse(action="stellar_balance", confidence=0.9,
                                  entities={"wallet": stellar_wallet})
        return IntentResponse(action="help", confidence=0.7, entities={})

    async def _execute_agentic(self, text: str, user_id: str, history: list = None,
                               platform: str = "web") -> Dict[str, Any]:
        stellar_wallet = self._extract_stellar_wallet_from_note(text)
        clean_text = self._clean_text(text)
        captured: Dict[str, Any] = {"actions": [], "execution": None, "last_swap_args": {}}

        system_prompt = self._build_agentic_system_prompt(stellar_wallet, platform)
        executor = self._make_stellar_executor(stellar_wallet, captured)

        result = await self.claude_engine.run(
            system_prompt=system_prompt,
            message=clean_text,
            tools=STELLAR_AGENT_TOOLS,
            tool_executor=executor,
        )

        reply = result.get("text") or "Como posso te ajudar com sua carteira Stellar hoje? 🌸"
        intent = self._synthesize_intent(captured, stellar_wallet)
        execution = captured["execution"] or {"status": "info"}
        logger.info("🤖 [AGENTIC] tools=%s stop=%s", captured["actions"], result.get("stop_reason"))
        return {"intent": intent, "reply_text": reply, "execution": execution}

    # ------------------------------------------------------------------
    # Main execution
    # ------------------------------------------------------------------

    async def execute(self, text: str, user_id: str, history: list = None, platform: str = "web") -> Dict[str, Any]:
        # 🤖 Agentic path (Claude) — falls back to the Gemini state machine on error.
        if self.claude_engine is not None:
            try:
                return await self._execute_agentic(text, user_id, history=history, platform=platform)
            except Exception as exc:
                logger.error("🤖 [AGENTIC] path failed, falling back to Gemini: %s", exc, exc_info=True)

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
