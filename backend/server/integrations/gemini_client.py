from __future__ import annotations

from typing import Any, Dict

import httpx


class GeminiClient:
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def classify_intent(self, user_text: str, history: list = None) -> Dict[str, Any]:
        if not self.enabled:
            return {"action": "fallback", "confidence": 0.0, "entities": {}}

        context_str = f" Histórico recente: {history}" if history else ""

        prompt = (
            "Classifique a intenção do usuário em JSON com este formato: "
            '{"action": "check_balance|swap_quote|swap_execute|help", '
            '"confidence": 0.0, "entities": {}}. '
            f"{context_str} "
            "Texto do usuário: " + user_text
        )

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        }

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            body = response.json()

        text = (
            body.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "{}")
        )

        try:
            import json

            parsed = json.loads(text)
        except Exception:
            return {"action": "fallback", "confidence": 0.0, "entities": {}}

        return {
            "action": parsed.get("action", "fallback"),
            "confidence": float(parsed.get("confidence", 0.0)),
            "entities": parsed.get("entities", {}),
        }

    async def generate_reply(self, instruction: str, user_text: str, history: list = None) -> str:
        if not self.enabled:
            return "Posso ajudar com saldo, cotação de swap e operações na Solana Devnet."

        context_str = f"\nHistórico da conversa: {history}" if history else ""

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                "Você é XiaoLee, assistente Solana amigável e objetiva. "
                                + instruction
                                + context_str
                                + "\nMensagem do usuário: "
                                + user_text
                            )
                        }
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.4},
        }

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            body = response.json()

        return (
            body.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "No momento nao consegui gerar resposta.")
        )
