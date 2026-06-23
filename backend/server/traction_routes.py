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

from server.metrics import get_traction_snapshot, record_payment_settled
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

    record_payment_settled(
        intent_id=event.intent_id,
        amount_usdc=event.amount,
        latency_ms=event.latency_ms,
        creator_handle=event.creator,
        tx=event.tx,
    )

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

    return {"ok": True, "recorded": broadcast_payload}


# ── POST /v1/creator/register ──────────────────────────────────────────────

@router.post("/v1/creator/register", status_code=200)
async def creator_register(payload: CreatorRegisterRequest) -> dict:
    """
    Onboarding de creator: associa Circle wallet_id ao @handle.
    Retorna elegibilidade para receber pagamentos USDC via agente.
    """
    handle = payload.twitter_handle.lstrip("@").lower()
    if not handle:
        raise HTTPException(status_code=422, detail="twitter_handle is required")

    wid_preview = payload.circle_wallet_id[:8] + "..." if len(payload.circle_wallet_id) >= 8 else payload.circle_wallet_id
    logger.info("creator_register | handle=@%s | circle_wallet=%s", handle, wid_preview)

    return {
        "ok": True,
        "creator": f"@{handle}",
        "circle_wallet_id": payload.circle_wallet_id,
        "eligible": True,
        "message": "Creator registered. You are now eligible to receive USDC payments.",
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
