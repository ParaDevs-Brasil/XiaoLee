import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker, AsyncEngine
from .base import Base
from pathlib import Path
from sqlalchemy.orm import sessionmaker
from typing import Tuple
from sqlalchemy import text

logger = logging.getLogger(__name__)

# Global variables for database engine and session factory
engine: AsyncEngine = None
SessionLocal: async_sessionmaker[AsyncSession] = None

def init_db() -> Tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """
    Initializes the database connection and returns both the engine and a session factory.
    """
    global engine, SessionLocal
    
    project_root = Path(__file__).resolve().parent.parent
    db_path = project_root / "xiao_lee.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    
    # Use the DATABASE_URL from environment if it exists, otherwise use the default path.
    final_db_url = os.getenv("DATABASE_URL", db_url)

    logger.info(f"Initializing database with URL: {final_db_url}")
    
    engine = create_async_engine(final_db_url, echo=False)
    
    SessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False
    )
    
    logger.info("Database session factory initialized successfully.")
    return engine, SessionLocal


async def get_session():
    global SessionLocal
    if SessionLocal is None:
        init_db()

    async with SessionLocal() as session:
        yield session


async def create_tables():
    global engine
    if engine is None:
        init_db()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_sqlite_migrations(conn)


async def _apply_sqlite_migrations(conn):
    """Apply small SQLite schema migrations for already-created databases."""
    if not str(conn.engine.url).startswith("sqlite"):
        return

    # Users table: add Telegram chat destination if it does not exist yet.
    result = await conn.execute(text("PRAGMA table_info(users)"))
    columns = {row[1] for row in result.fetchall()}
    if "telegram_chat_id" not in columns:
        await conn.execute(text("ALTER TABLE users ADD COLUMN telegram_chat_id TEXT"))

    # Notification/event tables are created via metadata.create_all, but older
    # SQLite files may have stale partial state; create_all above handles them.


async def drop_tables():
    global engine
    if engine is None:
        init_db()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def get_db_session():
    """Dependency injection to get a database session."""
    global SessionLocal
    if SessionLocal is None:
        init_db()

    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
