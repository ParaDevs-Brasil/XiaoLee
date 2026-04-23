from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime

from .models import User, DMLog

class DatabaseRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create_user(self, platform: str, user_id: str) -> User:
        """Get an existing user or create a new one based on platform ID."""
        # For simplicity, we assume twitter_user_id acts as the generic external ID
        # In a full implementation, we might separate telegram_id and twitter_id
        stmt = select(User).where(User.twitter_user_id == user_id)
        result = await self.session.execute(stmt)
        user = result.scalars().first()

        if not user:
            user = User(
                twitter_user_id=user_id,
                twitter_handle=f"{platform}_{user_id}" # Placeholder handle
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

    async def log_dm(self, user_id: int, platform: str, content: str, message_type: str = "user", error_message: str = None):
        """Log a direct message or response."""
        dm_log = DMLog(
            user_id=user_id,
            platform=platform,
            content=content,
            message_type=message_type,
            error_occurred=bool(error_message),
            error_message=error_message
        )
        self.session.add(dm_log)
        await self.session.flush()
        return dm_log

    async def get_user_history(self, user_id: int, limit: int = 5) -> list[dict]:
        """Get recent conversation history for a user."""
        stmt = select(DMLog).where(DMLog.user_id == user_id).order_by(DMLog.id.desc()).limit(limit)
        result = await self.session.execute(stmt)
        logs = result.scalars().all()
        # Return chronologically
        return [{"role": log.message_type, "content": log.content} for log in reversed(logs)]
