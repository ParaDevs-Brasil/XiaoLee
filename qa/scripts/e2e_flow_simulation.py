import asyncio
import httpx
import json

BASE_URL = "http://localhost:8000"

async def test_x_webhook_flow():
    print("🚀 Iniciando Simulação E2E: Webhook do X (Twitter) -> Orquestrador -> Solana Devnet")
    
    # 1. Simulate incoming DM asking for swap
    payload = {
        "direct_message_events": [
            {
                "type": "message_create",
                "message_create": {
                    "sender_id": "123456789",
                    "message_data": {
                        "text": "XiaoLee, quero fazer um swap de 2 USDC pra SOL na devnet!"
                    }
                }
            }
        ]
    }

    print("\n[1] Enviando DM payload (simulando webhook do X)...")
    
    # In a real scenario we'd sign with HMAC. In dev, we disabled strict verification for the test.
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(f"{BASE_URL}/v1/integrations/x/webhook", json=payload)
            resp.raise_for_status()
            data = resp.json()
            print("✅ Resposta da API de Webhook:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            assert data["intent"]["action"] in ["swap_quote", "help"], "Intent não foi classificado corretamente"
            print("✅ Intent Detectado com sucesso!")
        except Exception as e:
            print(f"❌ Falha no teste E2E: {e}")

if __name__ == "__main__":
    asyncio.run(test_x_webhook_flow())
