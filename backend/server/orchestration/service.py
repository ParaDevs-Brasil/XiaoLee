from __future__ import annotations

import re
from typing import Any, Dict

from server.integrations.gemini_client import GeminiClient
from server.integrations.solana_client import SolanaClient
from server.schemas import IntentResponse

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"


class OrchestrationService:
    def __init__(self, gemini: GeminiClient, solana: SolanaClient):
        self.gemini = gemini
        self.solana = solana

    async def detect_intent(self, text: str, user_id: str, history: list = None) -> IntentResponse:
        ai_intent = await self.gemini.classify_intent(text, history=history)
        if ai_intent.get("confidence", 0.0) >= 0.65:
            return IntentResponse(**ai_intent)

        lowered = text.lower()
        if "saldo" in lowered or "balance" in lowered:
            wallet = self._extract_wallet(text)
            return IntentResponse(
                action="check_balance",
                confidence=0.7,
                entities={"wallet": wallet},
            )

        if "quote" in lowered or "cotacao" in lowered or "swap" in lowered:
            amount = self._extract_amount(text) or 1.0
            return IntentResponse(
                action="swap_quote",
                confidence=0.7,
                entities={"amount": amount, "from": "USDC", "to": "SOL"},
            )

        return IntentResponse(action="help", confidence=0.5, entities={})

    async def execute(self, text: str, user_id: str, history: list = None) -> Dict[str, Any]:
        intent = await self.detect_intent(text, user_id, history=history)

        if intent.action == "check_balance":
            wallet = intent.entities.get("wallet")
            if not wallet:
                return {
                    "intent": intent,
                    "reply_text": "Envie o endereco da carteira para consultar saldo. Ex.: saldo <wallet>",
                    "execution": {"status": "missing_wallet"},
                }
            balance = await self.solana.get_balance(wallet)
            return {
                "intent": intent,
                "reply_text": f"Saldo na devnet: {balance['sol']:.6f} SOL.",
                "execution": balance,
            }

        if intent.action == "swap_quote":
            amount = float(intent.entities.get("amount", 1.0))
            amount_raw = int(amount * 1_000_000)
            quote = await self.solana.get_swap_quote(
                input_mint=USDC_DEVNET_MINT,
                output_mint=SOL_MINT,
                amount_raw=amount_raw,
            )
            out_amount = quote.get("outAmount", "0")
            reply = (
                f"Cotacao Jupiter (devnet): {amount:.2f} USDC -> {out_amount} unidades raw de SOL. "
                "Se quiser, eu preparo a transacao para assinatura na proxima etapa."
            )
            return {"intent": intent, "reply_text": reply, "execution": quote}

        instruction = (
            "Responda em portugues do Brasil e ofereca opcoes: consultar saldo, obter cotacao de swap, "
            "e preparar transacao na Solana devnet."
        )
        generic = await self.gemini.generate_reply(instruction=instruction, user_text=text, history=history)
        return {"intent": intent, "reply_text": generic, "execution": {"status": "info"}}

    def _extract_wallet(self, text: str) -> str | None:
        pattern = r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b"
        match = re.search(pattern, text)
        return match.group(0) if match else None

    def _extract_amount(self, text: str) -> float | None:
        match = re.search(r"(\d+(?:[\.,]\d+)?)", text)
        if not match:
            return None
        return float(match.group(1).replace(",", "."))
