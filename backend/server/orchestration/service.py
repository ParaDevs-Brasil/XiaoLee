from __future__ import annotations

import re
from typing import Any, Dict

from server.integrations.gemini_client import GeminiClient
from server.integrations.solana_client import SolanaClient
from server.schemas import IntentResponse

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"

_PLATFORM_CONTEXT = (
    "You are the AI core of the XiaoLee platform on Solana. "
    "XiaoLee lets users participate in creator campaigns and earn $XLEE tokens by completing "
    "social tasks (following accounts, engaging with tweets, retweeting). "
    "You can check wallet balances on Solana Devnet, fetch real-time swap quotes via Jupiter, "
    "and answer questions about the platform, campaigns, and Solana DeFi in general. "
    "Be proactive: if the user has a connected wallet, offer to check their balance or suggest campaigns."
)


class OrchestrationService:
    def __init__(self, gemini: GeminiClient, solana: SolanaClient):
        self.gemini = gemini
        self.solana = solana

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
        clean_text = self._clean_text(text)

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
