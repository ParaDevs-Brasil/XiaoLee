from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from .models import CampaignParticipant, PaymentIntent, User, DMLog


class DatabaseRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create_user(self, platform: str, user_id: str) -> User:
        stmt = select(User).where(User.twitter_user_id == user_id)
        result = await self.session.execute(stmt)
        user = result.scalars().first()

        if not user:
            user = User(
                twitter_user_id=user_id,
                twitter_handle=f"{platform}_{user_id}",
            )
            self.session.add(user)
            await self.session.flush()

        return user

    async def set_telegram_chat_id(self, user_id: int, chat_id: str | int) -> None:
        stmt = select(User).where(User.id == user_id)
        result = await self.session.execute(stmt)
        user = result.scalars().first()
        if not user:
            return
        user.telegram_chat_id = str(chat_id)
        await self.session.flush()

    async def log_dm(
        self,
        user_id: int,
        platform: str,
        content: str,
        message_type: str = "user",
        error_message: str = None,
    ):
        dm_log = DMLog(
            user_id=user_id,
            platform=platform,
            content=content,
            message_type=message_type,
            error_occurred=bool(error_message),
            error_message=error_message,
        )
        self.session.add(dm_log)
        await self.session.flush()
        return dm_log

    async def get_user_history(self, user_id: int, limit: int = 5) -> list[dict]:
        stmt = (
            select(DMLog)
            .where(DMLog.user_id == user_id)
            .order_by(DMLog.id.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        logs = result.scalars().all()
        return [{"role": log.message_type, "content": log.content} for log in reversed(logs)]

    # ------------------------------------------------------------------
    # Campaign participants — used by the agent tools
    # ------------------------------------------------------------------

    async def get_campaign_participants(
        self, campaign_id: int, limit: int = 50
    ) -> list[dict]:
        """Return enrolled/verified participants joined with user twitter_handle."""
        stmt = (
            select(CampaignParticipant, User)
            .join(User, User.id == CampaignParticipant.user_id)
            .where(CampaignParticipant.campaign_id == campaign_id)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        rows = result.all()
        return [
            {
                "creator_id": user.twitter_handle,
                "user_id": participant.user_id,
                "status": participant.status,
                "has_followed": participant.has_followed,
                "has_replied": participant.has_replied,
                "has_retweeted": participant.has_retweeted,
                "has_quoted": participant.has_quoted,
                "stellar_wallet": participant.stellar_wallet,
            }
            for participant, user in rows
        ]

    async def get_campaign_participant_by_creator(
        self, campaign_id: int, creator_id: str
    ) -> Optional[dict]:
        """Look up a participant by twitter_handle."""
        stmt = (
            select(CampaignParticipant, User)
            .join(User, User.id == CampaignParticipant.user_id)
            .where(
                CampaignParticipant.campaign_id == campaign_id,
                User.twitter_handle == creator_id,
            )
        )
        result = await self.session.execute(stmt)
        row = result.first()
        if not row:
            return None
        participant, user = row
        return {
            "creator_id": user.twitter_handle,
            "user_id": participant.user_id,
            "status": participant.status,
            "has_followed": participant.has_followed,
            "has_replied": participant.has_replied,
            "has_retweeted": participant.has_retweeted,
            "has_quoted": participant.has_quoted,
        }

    # ------------------------------------------------------------------
    # PaymentIntent CRUD — anti-replay + durable log
    # ------------------------------------------------------------------

    async def get_payment_intent(self, intent_id: str) -> Optional[PaymentIntent]:
        stmt = select(PaymentIntent).where(PaymentIntent.intent_id == intent_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_payment_intent_by_creator(
        self, campaign_id: int, creator_id: str
    ) -> Optional[PaymentIntent]:
        stmt = select(PaymentIntent).where(
            PaymentIntent.campaign_id == campaign_id,
            PaymentIntent.creator_id == creator_id,
            PaymentIntent.status.in_(["submitted", "confirmed"]),
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create_payment_intent(
        self,
        intent_id: str,
        campaign_id: int,
        creator_id: str,
        amount_usdc: float,
    ) -> PaymentIntent:
        intent = PaymentIntent(
            intent_id=intent_id,
            campaign_id=campaign_id,
            creator_id=creator_id,
            amount_usdc=amount_usdc,
            status="pending",
        )
        self.session.add(intent)
        await self.session.flush()
        await self.session.commit()
        return intent

    async def update_payment_intent(
        self,
        intent_id: str,
        status: str,
        tx_hash: Optional[str] = None,
    ) -> None:
        stmt = select(PaymentIntent).where(PaymentIntent.intent_id == intent_id)
        result = await self.session.execute(stmt)
        intent = result.scalars().first()
        if not intent:
            return
        intent.status = status
        if tx_hash:
            intent.arc_tx_hash = tx_hash
        if status in ("submitted", "confirmed"):
            intent.executed_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.commit()

    async def list_payment_intents_by_campaign(
        self, campaign_id: int
    ) -> list[PaymentIntent]:
        stmt = select(PaymentIntent).where(PaymentIntent.campaign_id == campaign_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
