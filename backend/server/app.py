from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import asyncio
import hashlib
import hmac
import logging
from time import perf_counter
from typing import Deque, Dict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from database import init_db
from database.database import create_tables
from database.database import get_db_session
from database.repository import DatabaseRepository
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from server.integrations.gemini_client import GeminiClient
from server.integrations.solana_client import SolanaClient
from server.integrations.telegram_client import TelegramClient
from server.integrations.telegram_adapter import TelegramAdapter
from server.integrations.telegram_poller import TelegramPoller
from server.integrations.x_poller import XPoller
from server.integrations.x_adapter import XAdapter
from server.orchestration.service import OrchestrationService
from server.metrics import record_http_request, render_prometheus_metrics
from server.schemas import InboundMessage, OrchestrationResponse, SwapPrepareRequest, SwapPrepareResponse
from server.settings import settings
from server.rate_limiter import get_rate_limiter, reset_rate_limiter
from server.webhooks.helius_routes import router as helius_router
from server.campaigns_routes import router as campaigns_router
from server.notifications_routes import router as notifications_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    await create_tables()
    await get_rate_limiter(redis_url=settings.redis_url or None)

    telegram_task: asyncio.Task | None = None
    if settings.telegram_bot_token:
        telegram_poller = TelegramPoller(
            bot_token=settings.telegram_bot_token,
            telegram_client=telegram_client,
            orchestrator=orchestrator,
        )
        telegram_task = asyncio.create_task(telegram_poller.start())
        logger.info("Telegram poller scheduled")

    x_task: asyncio.Task | None = None
    x_poller = XPoller(orchestrator=orchestrator)
    x_task = asyncio.create_task(x_poller.start())
    logger.info("X poller scheduled")

    yield

    for task in (telegram_task, x_task):
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    reset_rate_limiter()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    # Headers restritos: configurados via CORS_ALLOWED_HEADERS (env).
    # Padrao: Content-Type, Authorization, Accept, X-Requested-With.
    # '*' apenas em dev local, nunca em producao.
    allow_headers=settings.cors_allowed_headers,
)

app.include_router(helius_router)
app.include_router(campaigns_router)
app.include_router(notifications_router)

request_hits: Dict[str, Deque[datetime]] = defaultdict(deque)


@app.middleware("http")
async def collect_metrics(request: Request, call_next):
    started_at = perf_counter()
    response = await call_next(request)
    route_path = request.url.path
    if route_path != "/metrics":
        record_http_request(
            method=request.method,
            path=route_path,
            status_code=response.status_code,
            duration_seconds=perf_counter() - started_at,
        )
    return response


def _enforce_rate_limit(key: str):
    """
    Rate limit sincrono (legado) — usa in-memory para compatibilidade.
    Rotas novas devem usar `await _enforce_rate_limit_async(key)` diretamente.
    """
    # Usa in-memory diretamente para evitar problemas com event loop
    # O limiter Redis eh inicializado no lifespan e usado pelas rotas async
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=1)
    q = request_hits[key]
    while q and q[0] < window_start:
        q.popleft()
    if len(q) >= settings.inbound_rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    q.append(now)


async def _enforce_rate_limit_async(key: str) -> None:
    """Rate limit assíncrono — usa Redis (com fallback in-memory)."""
    limiter = await get_rate_limiter()
    await limiter.check(key=key, limit=settings.inbound_rate_limit_per_minute)


def _validate_x_signature(raw_body: bytes, provided_signature: str | None):
    if not settings.x_webhook_secret:
        return
    if not provided_signature:
        raise HTTPException(status_code=401, detail="Missing X signature")

    expected = hmac.new(
        settings.x_webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, provided_signature):
        raise HTTPException(status_code=401, detail="Invalid X signature")


def _validate_telegram_secret(provided_secret: str | None):
    if not settings.telegram_webhook_secret:
        return
    if not provided_secret:
        raise HTTPException(status_code=401, detail="Missing Telegram webhook secret")
    if not hmac.compare_digest(settings.telegram_webhook_secret, provided_secret):
        raise HTTPException(status_code=401, detail="Invalid Telegram webhook secret")

gemini_client = GeminiClient(api_key=settings.gemini_api_key, model=settings.gemini_model)
solana_client = SolanaClient(
    rpc_url=settings.solana_rpc_url,
    jupiter_quote_url=settings.jupiter_quote_url,
    jupiter_swap_url=settings.jupiter_swap_url,
)
orchestrator = OrchestrationService(gemini=gemini_client, solana=solana_client)
telegram_adapter = TelegramAdapter()
x_adapter = XAdapter()
telegram_client = TelegramClient(bot_token=settings.telegram_bot_token)


@app.get("/health")
async def health():
    try:
        rpc_health = await solana_client.get_health()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Solana RPC unavailable: {exc}") from exc

    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "solana_cluster": settings.solana_cluster,
        "rpc_health": rpc_health,
        "gemini_enabled": gemini_client.enabled,
    }


@app.get("/health/detailed")
async def health_detailed(db: AsyncSession = Depends(get_db_session)):
    """Health check granular com status de cada dependência e latência medida."""
    results: dict = {}

    # 1. Database
    try:
        from sqlalchemy import text as _text
        t0 = perf_counter()
        await db.execute(_text("SELECT 1"))
        db_latency = perf_counter() - t0
        results["database"] = {"status": "ok", "latency_ms": round(db_latency * 1000, 2)}
    except Exception as exc:
        results["database"] = {"status": "error", "detail": str(exc)}

    # 2. Solana RPC
    try:
        t0 = perf_counter()
        rpc_health = await asyncio.wait_for(solana_client.get_health(), timeout=5.0)
        results["solana_rpc"] = {
            "status": "ok",
            "latency_ms": round((perf_counter() - t0) * 1000, 2),
            "cluster": settings.solana_cluster,
            "rpc_response": rpc_health,
        }
    except asyncio.TimeoutError:
        results["solana_rpc"] = {"status": "timeout", "detail": "RPC did not respond within 5s"}
    except Exception as exc:
        results["solana_rpc"] = {"status": "error", "detail": str(exc)}

    # 3. Gemini
    results["gemini"] = {
        "status": "enabled" if gemini_client.enabled else "disabled",
        "model": settings.gemini_model,
    }

    # 4. Jupiter API (quote endpoint reachable)
    try:
        t0 = perf_counter()
        # Verifica apenas conectividade com um quote minimo
        test_quote = await asyncio.wait_for(
            solana_client.get_swap_quote(
                input_mint="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                output_mint="So11111111111111111111111111111111111111112",
                amount_raw=1_000_000,
            ),
            timeout=5.0,
        )
        results["jupiter"] = {
            "status": "ok",
            "latency_ms": round((perf_counter() - t0) * 1000, 2),
            "out_amount_raw": test_quote.get("outAmount"),
        }
    except asyncio.TimeoutError:
        results["jupiter"] = {"status": "timeout", "detail": "Jupiter did not respond within 5s"}
    except Exception as exc:
        results["jupiter"] = {"status": "error", "detail": str(exc)}

    overall = "ok" if all(v.get("status") in {"ok", "enabled", "disabled"} for v in results.values()) else "degraded"
    return {
        "status": overall,
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "dependencies": results,
    }


@app.get("/status")
async def status():
    return {"status": "running"}


@app.get("/metrics")
async def metrics():
    return Response(render_prometheus_metrics(), media_type="text/plain; version=0.0.4; charset=utf-8")


async def _process_inbound(
    platform: str,
    user_id: str,
    text: str,
    db: AsyncSession,
    metadata: dict | None = None,
) -> OrchestrationResponse:
    repo = DatabaseRepository(db)
    user = await repo.get_or_create_user(platform, user_id)
    if platform == "telegram" and metadata and metadata.get("chat_id"):
        await repo.set_telegram_chat_id(user.id, metadata["chat_id"])
    history = await repo.get_user_history(user.id, limit=10)
    await repo.log_dm(user.id, platform, text, message_type="user")

    result = await orchestrator.execute(text, user_id, history=history, platform=platform)

    await repo.log_dm(user.id, platform, result["reply_text"], message_type="bot")
    await db.commit()

    return OrchestrationResponse(
        platform=platform,
        user_id=user_id,
        intent=result["intent"],
        reply_text=result["reply_text"],
        execution=result["execution"],
    )


@app.post("/v1/messages/inbound", response_model=OrchestrationResponse)
async def inbound_message(payload: InboundMessage, db: AsyncSession = Depends(get_db_session)):
    _enforce_rate_limit(f"inbound:{payload.platform}:{payload.user_id}")

    return await _process_inbound(
        platform=payload.platform,
        user_id=payload.user_id,
        text=payload.text,
        db=db,
        metadata=payload.metadata,
    )


@app.post("/chat")
async def chat_compat(
    payload: dict,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    """Compatibility endpoint used by the current frontend chat hook."""
    text = str(payload.get("message", "")).strip()
    if not text:
        raise HTTPException(status_code=400, detail="message is required")

    wallet_address = payload.get("wallet_address")
    if wallet_address:
        text = f"[System Note: User connected wallet is {wallet_address}] {text}"

    session_token = ""
    if authorization and authorization.startswith("Bearer "):
        session_token = authorization.removeprefix("Bearer ").strip()

    user_id = session_token or str(payload.get("user_id", "web_anonymous"))
    platform = str(payload.get("platform", "web"))

    _enforce_rate_limit(f"chat:{platform}:{user_id}")
    result = await _process_inbound(platform=platform, user_id=user_id, text=text, db=db)

    # Keep legacy response shape consumed by frontend ChatPanel.
    return {
        "response": [{"type": "text", "content": result.reply_text}],
        "intent": result.intent.model_dump(),
        "execution": result.execution,
        "code": None,
        "animations": None,
    }


@app.post("/v1/integrations/telegram/webhook", response_model=OrchestrationResponse)
async def telegram_webhook(
    update: dict,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session)
):
    _validate_telegram_secret(x_telegram_bot_api_secret_token)
    normalized = telegram_adapter.normalize_update(update)
    if not normalized.get("text"):
        raise HTTPException(status_code=400, detail="No text message in Telegram update")

    _enforce_rate_limit(f"telegram:{normalized['user_id']}")

    result = await _process_inbound(
        platform="telegram",
        user_id=normalized["user_id"],
        text=normalized["text"],
        db=db,
        metadata=normalized.get("metadata", {}),
    )

    chat_id = normalized.get("metadata", {}).get("chat_id")
    if chat_id and result.reply_text:
        try:
            await telegram_client.send_message(chat_id, result.reply_text)
        except Exception as exc:
            logger.error("Failed to send Telegram reply to chat %s: %s", chat_id, exc)

    return result


@app.post("/v1/integrations/x/webhook", response_model=OrchestrationResponse)
async def x_webhook(
    request: Request,
    x_xiaolee_signature: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session)
):
    raw_body = await request.body()
    _validate_x_signature(raw_body, x_xiaolee_signature)

    try:
        event = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    normalized = x_adapter.normalize_event(event)
    if not normalized.get("text"):
        raise HTTPException(status_code=400, detail="No DM text found in X event")

    _enforce_rate_limit(f"x:{normalized['user_id']}")

    return await _process_inbound(
        platform="x",
        user_id=normalized["user_id"],
        text=normalized["text"],
        db=db,
    )


@app.post("/v1/solana/swap/prepare", response_model=SwapPrepareResponse)
async def prepare_swap(payload: SwapPrepareRequest):
    quote = await solana_client.get_swap_quote(
        input_mint=payload.input_mint,
        output_mint=payload.output_mint,
        amount_raw=payload.amount_raw,
        slippage_bps=payload.slippage_bps,
    )
    swap_data = await solana_client.prepare_swap_transaction(
        quote_response=quote,
        user_public_key=payload.user_public_key,
    )

    swap_tx = swap_data.get("swapTransaction")
    if not swap_tx:
        raise HTTPException(status_code=502, detail="Jupiter did not return swap transaction")

    return SwapPrepareResponse(
        cluster=settings.solana_cluster,
        quote=quote,
        swap_transaction_base64=swap_tx,
        last_valid_block_height=swap_data.get("lastValidBlockHeight"),
        disclaimer="Transacao somente preparada. Assine na wallet e confirme antes do envio.",
    )
