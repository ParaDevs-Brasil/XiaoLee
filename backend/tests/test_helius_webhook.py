import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from unittest.mock import AsyncMock
import importlib

import server.webhooks.helius_routes as helius_routes_module

app_module = importlib.import_module("server.app")
from database.database import get_db_session
from database.models import NotificationEvent, OnchainEvent, TransactionHistory, User


client = TestClient(app_module.app)


def _set_helius_secret():
    object.__setattr__(app_module.settings, "helius_webhook_secret", "helius-secret")


@pytest.mark.asyncio
async def test_helius_webhook_persists_swap_and_updates_transaction(db_session):
    _set_helius_secret()

    user = User(twitter_handle="@alice", twitter_user_id="alice-1")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    tx = TransactionHistory(
        user_id=user.id,
        transaction_type="swap",
        token_symbol="USDC",
        amount=10,
        tx_hash="sig-123",
        status="pending",
    )
    db_session.add(tx)
    await db_session.commit()
    await db_session.refresh(tx)

    async def override_db_session():
        yield db_session

    app_module.app.dependency_overrides[get_db_session] = override_db_session
    try:
        response = client.post(
            "/v1/solana/webhooks/helius",
            json=[
                {
                    "type": "SWAP",
                    "signature": "sig-123",
                    "transactionError": None,
                    "tokenTransfers": [],
                    "nativeTransfers": [],
                }
            ],
            headers={"authorization": "helius-secret"},
        )

        assert response.status_code == 200
        assert response.json()["processed_events"] == 1

        updated_tx = (await db_session.execute(select(TransactionHistory).where(TransactionHistory.tx_hash == "sig-123"))).scalar_one()
        assert updated_tx.status == "completed"
        assert updated_tx.confirmation_blocks == 1

        stored_event = (await db_session.execute(select(OnchainEvent).where(OnchainEvent.signature == "sig-123"))).scalar_one()
        assert stored_event.event_type == "SWAP"
        assert stored_event.status == "success"

        notification = (await db_session.execute(select(NotificationEvent).where(NotificationEvent.related_signature == "sig-123"))).scalar_one()
        assert notification.title == "Swap confirmado"
        assert notification.status == "pending"
    finally:
        app_module.app.dependency_overrides.pop(get_db_session, None)


@pytest.mark.asyncio
async def test_helius_webhook_creates_x_delivery_notification(db_session):
    _set_helius_secret()

    user = User(twitter_handle="@bob", twitter_user_id="x-user-1")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    tx = TransactionHistory(
        user_id=user.id,
        transaction_type="swap",
        token_symbol="USDC",
        amount=20,
        tx_hash="sig-456",
        status="pending",
    )
    db_session.add(tx)
    await db_session.commit()
    await db_session.refresh(tx)

    async def override_db_session():
        yield db_session

    app_module.app.dependency_overrides[get_db_session] = override_db_session
    send_mock = AsyncMock(return_value={"success": True, "result": {"id": "msg-1"}})

    previous_token = helius_routes_module.x_client.bearer_token
    previous_send_dm = helius_routes_module.x_client.send_dm
    try:
        helius_routes_module.x_client.send_dm = send_mock
        helius_routes_module.x_client.bearer_token = "token"

        response = client.post(
            "/v1/solana/webhooks/helius",
            json=[
                {
                    "type": "SWAP",
                    "signature": "sig-456",
                    "transactionError": None,
                    "tokenTransfers": [],
                    "nativeTransfers": [],
                }
            ],
            headers={"authorization": "helius-secret"},
        )

        assert response.status_code == 200
        assert response.json()["processed_events"] == 1

        x_notification = (
            await db_session.execute(
                select(NotificationEvent).where(
                    NotificationEvent.related_signature == "sig-456",
                    NotificationEvent.channel == "x",
                )
            )
        ).scalar_one()
        assert x_notification.status == "delivered"
        assert x_notification.delivered_at is not None
        send_mock.assert_awaited_once()
    finally:
        helius_routes_module.x_client.bearer_token = previous_token
        helius_routes_module.x_client.send_dm = previous_send_dm
        app_module.app.dependency_overrides.pop(get_db_session, None)