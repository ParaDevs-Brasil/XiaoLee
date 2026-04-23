from datetime import datetime, timezone
import json

from fastapi import APIRouter, Depends, Header, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.database import get_db_session
from database.models import DMLog, NotificationEvent, OnchainEvent, TransactionHistory, User
from ..integrations.telegram_client import TelegramClient
from ..integrations.x_client import XClient
from ..integrations.helius_client import HeliusClient
from ..settings import settings

router = APIRouter()
helius_client = HeliusClient(
    api_key=settings.helius_api_key if hasattr(settings, 'helius_api_key') else None,
    webhook_secret=settings.helius_webhook_secret if hasattr(settings, 'helius_webhook_secret') else None
)
telegram_client = TelegramClient(bot_token=settings.telegram_bot_token)
x_client = XClient(
    bearer_token=settings.x_bearer_token,
    api_base_url=settings.x_dm_api_base_url,
)

@router.post("/v1/solana/webhooks/helius")
async def helius_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session),
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

    processed = 0
    for event in events:
        if event["type"] == "SWAP":
            processed += 1
            signature = event["signature"] or "unknown"
            payload_text = json.dumps(event, ensure_ascii=False)

            existing_stmt = select(OnchainEvent).where(OnchainEvent.signature == signature)
            existing_res = await db.execute(existing_stmt)
            existing_event = existing_res.scalars().first()

            if existing_event:
                existing_event.status = event["status"].lower()
                existing_event.event_type = event["type"]
                existing_event.tx_hash = signature
                existing_event.raw_payload = payload_text
                existing_event.processed_at = datetime.now(timezone.utc)
            else:
                db.add(
                    OnchainEvent(
                        signature=signature,
                        event_type=event["type"],
                        status=event["status"].lower(),
                        source="helius",
                        raw_payload=payload_text,
                        tx_hash=signature,
                        processed_at=datetime.now(timezone.utc),
                    )
                )

            tx_stmt = select(TransactionHistory).where(TransactionHistory.tx_hash == signature)
            tx_res = await db.execute(tx_stmt)
            transaction = tx_res.scalars().first()
            if transaction:
                transaction.status = "completed" if event["status"] == "SUCCESS" else "failed"
                transaction.confirmation_blocks = max(transaction.confirmation_blocks or 0, 1)
                transaction.error_message = None if transaction.status == "completed" else f"Helius status: {event['status']}"

                user_stmt = select(User).where(User.id == transaction.user_id)
                user_res = await db.execute(user_stmt)
                user = user_res.scalars().first()
                if user:
                    notification_title = "Swap confirmado" if transaction.status == "completed" else "Swap com falha"
                    notification_body = (
                        f"Seu swap on-chain foi {transaction.status}. Signature: {signature}."
                        if transaction.status == "completed"
                        else f"Seu swap on-chain falhou. Signature: {signature}."
                    )

                    db.add(
                        DMLog(
                            user_id=user.id,
                            platform="system",
                            message_type="bot",
                            content=notification_body,
                            conversation_id=signature,
                            session_id=signature,
                            request_id=signature,
                            error_occurred=transaction.status != "completed",
                            error_message=transaction.error_message,
                        )
                    )
                    db.add(
                        NotificationEvent(
                            user_id=user.id,
                            channel="in_app",
                            title=notification_title,
                            body=notification_body,
                            status="pending",
                            related_signature=signature,
                            metadata_json=json.dumps(
                                {
                                    "event_type": event["type"],
                                    "tx_status": transaction.status,
                                    "source": "helius",
                                },
                                ensure_ascii=False,
                            ),
                        )
                    )

                    if user.telegram_chat_id and telegram_client.enabled:
                        try:
                            send_result = await telegram_client.send_message(user.telegram_chat_id, f"{notification_title}: {notification_body}")
                            if send_result.get("success"):
                                sent_notification = NotificationEvent(
                                    user_id=user.id,
                                    channel="telegram",
                                    title=notification_title,
                                    body=notification_body,
                                    status="delivered",
                                    related_signature=signature,
                                    metadata_json=json.dumps({"channel": "telegram", "delivered": True}, ensure_ascii=False),
                                    delivered_at=datetime.now(timezone.utc),
                                )
                                db.add(sent_notification)
                                db.add(
                                    DMLog(
                                        user_id=user.id,
                                        platform="telegram",
                                        message_type="bot",
                                        content=f"[sent] {notification_title}: {notification_body}",
                                        conversation_id=signature,
                                        session_id=signature,
                                        request_id=signature,
                                    )
                                )
                        except Exception as exc:
                            db.add(
                                NotificationEvent(
                                    user_id=user.id,
                                    channel="telegram",
                                    title=notification_title,
                                    body=notification_body,
                                    status="failed",
                                    related_signature=signature,
                                    metadata_json=json.dumps({"error": str(exc), "channel": "telegram"}, ensure_ascii=False),
                                    error_message=str(exc),
                                )
                            )

                    if x_client.enabled and user.twitter_user_id:
                        try:
                            send_result = await x_client.send_dm(user.twitter_user_id, f"{notification_title}: {notification_body}")
                            if send_result.get("success"):
                                db.add(
                                    NotificationEvent(
                                        user_id=user.id,
                                        channel="x",
                                        title=notification_title,
                                        body=notification_body,
                                        status="delivered",
                                        related_signature=signature,
                                        metadata_json=json.dumps({"channel": "x", "delivered": True}, ensure_ascii=False),
                                        delivered_at=datetime.now(timezone.utc),
                                    )
                                )
                                db.add(
                                    DMLog(
                                        user_id=user.id,
                                        platform="x",
                                        message_type="bot",
                                        content=f"[sent] {notification_title}: {notification_body}",
                                        conversation_id=signature,
                                        session_id=signature,
                                        request_id=signature,
                                    )
                                )
                        except Exception as exc:
                            db.add(
                                NotificationEvent(
                                    user_id=user.id,
                                    channel="x",
                                    title=notification_title,
                                    body=notification_body,
                                    status="failed",
                                    related_signature=signature,
                                    metadata_json=json.dumps({"error": str(exc), "channel": "x"}, ensure_ascii=False),
                                    error_message=str(exc),
                                )
                            )

    if processed:
        await db.commit()

    return {"status": "success", "processed_events": processed}
