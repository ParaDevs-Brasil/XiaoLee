"""
Traction routes — RFB-06 Creator Monetization.

Endpoints:
  POST /v1/payments/settled   — agente (f0ntz) chama ao confirmar pagamento USDC on-chain
  POST /v1/creator/register   — onboarding de creator via Circle App Kit
  GET  /v1/traction/stats     — snapshot JSON para polling do dashboard
  GET  /v1/traction/feed      — SSE stream: evento payment_settled em tempo real
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from server.integrations.circle_client import get_wallet, transfer_usdc
from server.metrics import get_traction_snapshot, get_registered_creator_wallet, record_payment_settled, register_creator
from server.schemas import CreatorRegisterRequest, PaymentSettledEvent, TractionSnapshot
from server.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["traction"])

# Ring-buffer de asyncio.Queue para fanout SSE — uma fila por cliente conectado.
_sse_clients: list[asyncio.Queue] = []


def _broadcast(event_data: dict) -> None:
    """Envia o evento para todos os clientes SSE conectados (thread-safe via put_nowait)."""
    dead: list[asyncio.Queue] = []
    for q in list(_sse_clients):
        try:
            q.put_nowait(event_data)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        try:
            _sse_clients.remove(q)
        except ValueError:
            pass


def _validate_arc_secret(provided: str | None) -> None:
    """Valida shared secret entre o agente Arc e este endpoint."""
    expected = settings.arc_payment_secret
    if not expected:
        return
    if not provided:
        raise HTTPException(status_code=401, detail="Missing X-Arc-Secret header")
    import hmac as _hmac
    if not _hmac.compare_digest(expected, provided):
        raise HTTPException(status_code=401, detail="Invalid X-Arc-Secret")


# ── POST /v1/payments/settled ──────────────────────────────────────────────

@router.post("/v1/payments/settled", status_code=200)
async def payment_settled(
    event: PaymentSettledEvent,
    x_arc_secret: str | None = Header(default=None),
) -> dict:
    """
    Chamado pelo agente (f0ntz) quando um pagamento USDC é confirmado on-chain.
    Registra métricas, persiste no feed e faz broadcast SSE para o dashboard.
    """
    _validate_arc_secret(x_arc_secret)

    ts = event.ts or (datetime.now(timezone.utc).isoformat())

    is_new = record_payment_settled(
        intent_id=event.intent_id,
        amount_usdc=event.amount,
        latency_ms=event.latency_ms,
        creator_handle=event.creator,
        tx=event.tx,
    )

    if not is_new:
        logger.warning("payment_settled duplicate | intent_id=%s — ignored", event.intent_id)
        return {"ok": True, "recorded": None, "duplicate": True, "circle_transfer_id": None}

    broadcast_payload = {
        "intent_id": event.intent_id,
        "amount": event.amount,
        "creator": event.creator,
        "tx": event.tx,
        "ts": ts,
        "latency_ms": event.latency_ms,
    }
    _broadcast(broadcast_payload)

    logger.info(
        "payment_settled | creator=%s | amount=%.4f USDC | latency=%.1fms | tx=%s",
        event.creator,
        event.amount,
        event.latency_ms,
        event.tx[:16] + "..." if len(event.tx) > 16 else event.tx,
    )

    # Dispara transferência Circle apenas para eventos novos (idempotência garantida pelo intent_id)
    circle_transfer_id: str | None = None
    creator_wallet = get_registered_creator_wallet(event.creator)
    if creator_wallet and settings.circle_api_key:
        transfer = await transfer_usdc(
            destination_wallet_id=creator_wallet,
            amount_usdc=event.amount,
            idempotency_key=event.intent_id,
        )
        if transfer:
            circle_transfer_id = transfer.get("id")
            logger.info(
                "circle_transfer | creator=%s | transfer_id=%s | status=%s",
                event.creator, circle_transfer_id, transfer.get("status"),
            )

    return {"ok": True, "recorded": broadcast_payload, "duplicate": False, "circle_transfer_id": circle_transfer_id}


# ── POST /v1/creator/register ──────────────────────────────────────────────

@router.post("/v1/creator/register", status_code=200)
async def creator_register(payload: CreatorRegisterRequest) -> dict:
    """
    Onboarding de creator: associa Circle wallet_id ao @handle.
    Idempotente — re-registro do mesmo handle retorna 200 com already_registered=True.
    Valida que a Circle wallet existe quando CIRCLE_API_KEY está configurada.
    """
    handle = payload.twitter_handle.lstrip("@").lower()
    if not handle:
        raise HTTPException(status_code=422, detail="twitter_handle is required")
    wallet_id = payload.circle_wallet_id.strip()
    if not wallet_id:
        raise HTTPException(status_code=422, detail="circle_wallet_id is required")

    # Valida wallet na Circle API (só bloqueia se a chave estiver configurada)
    if settings.circle_api_key:
        wallet_data = await get_wallet(wallet_id)
        if wallet_data is None:
            raise HTTPException(status_code=422, detail="circle_wallet_id not found in Circle — check the ID and try again")

    result = register_creator(handle, wallet_id)

    wid_preview = wallet_id[:8] + "..." if len(wallet_id) >= 8 else wallet_id
    logger.info(
        "creator_register | handle=@%s | circle_wallet=%s | already_registered=%s",
        handle, wid_preview, result["already_registered"],
    )

    return {
        "ok": True,
        "creator": f"@{handle}",
        "circle_wallet_id": wallet_id,
        "eligible": True,
        "already_registered": result["already_registered"],
        "registered_at": result["registered_at"],
        "message": (
            "Already registered. You are eligible to receive USDC payments."
            if result["already_registered"]
            else "Creator registered. You are now eligible to receive USDC payments."
        ),
    }


# ── GET /v1/traction/stats ─────────────────────────────────────────────────

@router.get("/v1/traction/stats", response_model=TractionSnapshot)
async def traction_stats() -> TractionSnapshot:
    """Snapshot agregado das métricas de tração — chamado pelo dashboard a cada 5s."""
    snap = get_traction_snapshot()
    return TractionSnapshot(**snap)


# ── GET /v1/traction/feed (SSE) ────────────────────────────────────────────

@router.get("/v1/traction/feed")
async def traction_feed(request: Request) -> StreamingResponse:
    """
    SSE stream: emite evento `payment_settled` sempre que um pagamento é confirmado.
    O dashboard conecta aqui para atualizar o live feed sem polling.

    Formato do evento:
      event: payment_settled
      data: {"intent_id":..., "amount":..., "creator":..., "tx":..., "ts":..., "latency_ms":...}
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _sse_clients.append(queue)

    async def event_stream() -> AsyncIterator[str]:
        # Heartbeat inicial: envia snapshot atual para o cliente recém-conectado
        snap = get_traction_snapshot()
        yield f"event: snapshot\ndata: {json.dumps(snap)}\n\n"

        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Aguarda próximo evento com timeout para enviar heartbeat
                    data = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"event: payment_settled\ndata: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat para manter a conexão viva
                    yield ": keepalive\n\n"
        finally:
            try:
                _sse_clients.remove(queue)
            except ValueError:
                pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
