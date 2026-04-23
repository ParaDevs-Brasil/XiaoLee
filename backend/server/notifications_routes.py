from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.database import get_db_session
from database.models import NotificationEvent, User

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: int
    channel: str
    title: str
    body: str
    status: str
    related_signature: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class AckResponse(BaseModel):
    success: bool
    notification_id: int
    status: str


@router.get("/{twitter_user_id}")
async def list_notifications(
    twitter_user_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    user_stmt = select(User).where(User.twitter_user_id == twitter_user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    stmt = select(NotificationEvent).where(NotificationEvent.user_id == user.id).order_by(NotificationEvent.id.desc())
    result = await db.execute(stmt)
    notifications = []
    for notification in result.scalars().all():
        metadata = {}
        if notification.metadata_json:
            try:
                metadata = json.loads(notification.metadata_json)
            except Exception:
                metadata = {"raw": notification.metadata_json}

        notifications.append(
            NotificationResponse(
                id=notification.id,
                channel=notification.channel,
                title=notification.title,
                body=notification.body,
                status=notification.status,
                related_signature=notification.related_signature,
                metadata=metadata,
            )
        )

    return {"success": True, "notifications": notifications}


@router.post("/{notification_id}/ack", response_model=AckResponse)
async def ack_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    stmt = select(NotificationEvent).where(NotificationEvent.id == notification_id)
    result = await db.execute(stmt)
    notification = result.scalars().first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.status = "delivered"
    notification.delivered_at = notification.delivered_at or datetime.now(timezone.utc)
    await db.commit()

    return AckResponse(success=True, notification_id=notification.id, status=notification.status)