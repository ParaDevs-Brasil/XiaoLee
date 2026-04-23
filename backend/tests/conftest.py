import pytest
import asyncio
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from database.base import Base


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)
    
    async with SessionLocal() as session:
        yield session


@pytest.fixture
def sample_user_data():
    return {
        "twitter_handle": "@test_user",
        "twitter_user_id": "123456789"
    }


@pytest.fixture  
def sample_wallet_data():
    return {
        "address": "0x1234567890abcdef1234567890abcdef12345678",
        "private_key_encrypted": "encrypted_private_key_data_here"
    }


@pytest.fixture
def sample_token_data():
    return {
        "symbol": "ETH",
        "name": "Ethereum",
        "price_usd": 2000.00,
        "decimals": 18,
        "is_active": True,
    } 


@pytest.fixture
def sample_swap_data():
    return {
        "from_token": "USDC",
        "to_token": "SOL",
        "from_amount": 10.0,
        "to_amount": 0.05,
        "exchange_rate": 0.005,
        "value_usd": 10.0,
        "status": "completed",
    }


@pytest.fixture
def sample_transaction_data():
    return {
        "transaction_type": "transfer",
        "token_symbol": "USDC",
        "amount": 5.0,
        "to_address": "dest-address-1",
        "status": "pending",
    }


@pytest.fixture
def sample_dm_log_data():
    return {
        "message_type": "user",
        "content": "hello",
        "platform": "telegram",
        "session_id": "session-1",
        "error_occurred": False,
    }