from fastapi import APIRouter, Header, Request, HTTPException
from typing import List, Dict, Any
from ..integrations.helius_client import HeliusClient
from ..settings import settings

router = APIRouter()
helius_client = HeliusClient(
    api_key=settings.helius_api_key if hasattr(settings, 'helius_api_key') else None,
    webhook_secret=settings.helius_webhook_secret if hasattr(settings, 'helius_webhook_secret') else None
)

@router.post("/v1/solana/webhooks/helius")
async def helius_webhook(
    request: Request,
    authorization: str | None = Header(default=None)
):
    """
    Receives webhook events from Helius.
    Helius sends the secret in the Authorization header.
    """
    raw_body = await request.body()
    
    # Helius passes the webhook secret in the Authorization header
    if helius_client.webhook_secret and authorization != helius_client.webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid Helius Webhook Secret")

    try:
        data = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    # Parse and handle SWAP events
    events = helius_client.parse_transaction_event(data)
    
    for event in events:
        if event["type"] == "SWAP":
            # TODO: Match the swap signature with a PendingTransfer or SwapHistory in DB
            # and trigger a notification to the user via Telegram/X adapters.
            print(f"Swap Confirmed! Signature: {event['signature']} Status: {event['status']}")
            
    return {"status": "success", "processed_events": len(events)}
