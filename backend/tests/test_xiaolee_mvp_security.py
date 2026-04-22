import hashlib
import hmac

from fastapi.testclient import TestClient

import server.app as app_module


class StubOrchestrator:
    async def execute(self, text: str, user_id: str):
        return {
            "intent": {"action": "help", "confidence": 1.0, "entities": {}},
            "reply_text": "ok",
            "execution": {"status": "ok"},
        }


class StubSolana:
    async def get_swap_quote(self, input_mint: str, output_mint: str, amount_raw: int, slippage_bps: int = 50):
        return {"routePlan": [], "outAmount": "1"}

    async def prepare_swap_transaction(self, quote_response, user_public_key: str):
        return {"swapTransaction": "BASE64_TX", "lastValidBlockHeight": 123}


client = TestClient(app_module.app)


def _set_webhook_secrets():
    object.__setattr__(app_module.settings, "telegram_webhook_secret", "telegram-secret")
    object.__setattr__(app_module.settings, "x_webhook_secret", "x-secret")
    app_module.orchestrator = StubOrchestrator()
    app_module.request_hits.clear()


def test_telegram_webhook_rejects_missing_secret():
    _set_webhook_secrets()

    response = client.post(
        "/v1/integrations/telegram/webhook",
        json={"message": {"text": "oi", "from": {"id": 1}, "chat": {"id": 9}}},
    )

    assert response.status_code == 401


def test_x_webhook_rejects_invalid_signature():
    _set_webhook_secrets()

    body = b'{"dm":{"sender_id":"1","text":"oi"}}'
    response = client.post(
        "/v1/integrations/x/webhook",
        content=body,
        headers={"Content-Type": "application/json", "x-xiaolee-signature": "invalid"},
    )

    assert response.status_code == 401


def test_x_webhook_accepts_valid_signature():
    _set_webhook_secrets()

    body = b'{"dm":{"sender_id":"1","text":"oi"}}'
    signature = hmac.new(b"x-secret", body, hashlib.sha256).hexdigest()
    response = client.post(
        "/v1/integrations/x/webhook",
        content=body,
        headers={"Content-Type": "application/json", "x-xiaolee-signature": signature},
    )

    assert response.status_code == 200
    assert response.json()["platform"] == "x"


def test_prepare_swap_returns_unsigned_transaction():
    app_module.solana_client = StubSolana()

    response = client.post(
        "/v1/solana/swap/prepare",
        json={
            "user_public_key": "8Y7NwkjVaY7LHKV8ha2g8xD6LTY64PrtP6Qwzcw7f6Vj",
            "input_mint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
            "output_mint": "So11111111111111111111111111111111111111112",
            "amount_raw": 1000000,
            "slippage_bps": 50,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["swap_transaction_base64"] == "BASE64_TX"
    assert "Assine" in data["disclaimer"]
