from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
from typing import Deque, Dict

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from database.database import get_db_session
from database.repository import DatabaseRepository
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from server.integrations.gemini_client import GeminiClient
from server.integrations.solana_client import SolanaClient
from server.integrations.telegram_adapter import TelegramAdapter
from server.integrations.x_adapter import XAdapter
from server.orchestration.service import OrchestrationService
from server.schemas import InboundMessage, OrchestrationResponse, SwapPrepareRequest, SwapPrepareResponse
from server.settings import settings
from server.webhooks.helius_routes import router as helius_router
from server.campaigns_routes import router as campaigns_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(helius_router)
app.include_router(campaigns_router)

request_hits: Dict[str, Deque[datetime]] = defaultdict(deque)


def _enforce_rate_limit(key: str):
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=1)
    q = request_hits[key]

    while q and q[0] < window_start:
        q.popleft()

    if len(q) >= settings.inbound_rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    q.append(now)


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


@app.on_event("startup")
async def startup():
    init_db()


gemini_client = GeminiClient(api_key=settings.gemini_api_key, model=settings.gemini_model)
solana_client = SolanaClient(
    rpc_url=settings.solana_rpc_url,
    jupiter_quote_url=settings.jupiter_quote_url,
    jupiter_swap_url=settings.jupiter_swap_url,
)
orchestrator = OrchestrationService(gemini=gemini_client, solana=solana_client)
telegram_adapter = TelegramAdapter()
x_adapter = XAdapter()


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


@app.get("/status")
async def status():
    return {"status": "running"}


@app.post("/v1/messages/inbound", response_model=OrchestrationResponse)
async def inbound_message(payload: InboundMessage, db: AsyncSession = Depends(get_db_session)):
    _enforce_rate_limit(f"inbound:{payload.platform}:{payload.user_id}")
    
    repo = DatabaseRepository(db)
    user = await repo.get_or_create_user(payload.platform, payload.user_id)
    history = await repo.get_user_history(user.id)
    await repo.log_dm(user.id, payload.platform, payload.text, message_type="user")
    
    result = await orchestrator.execute(payload.text, payload.user_id, history=history)
    
    await repo.log_dm(user.id, payload.platform, result["reply_text"], message_type="bot")
    await db.commit()
    
    return OrchestrationResponse(
        platform=payload.platform,
        user_id=payload.user_id,
        intent=result["intent"],
        reply_text=result["reply_text"],
        execution=result["execution"],
    )


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

    repo = DatabaseRepository(db)
    user = await repo.get_or_create_user("telegram", normalized["user_id"])
    history = await repo.get_user_history(user.id)
    await repo.log_dm(user.id, "telegram", normalized["text"], message_type="user")

    result = await orchestrator.execute(normalized["text"], normalized["user_id"], history=history)
    
    await repo.log_dm(user.id, "telegram", result["reply_text"], message_type="bot")
    await db.commit()

    return OrchestrationResponse(
        platform="telegram",
        user_id=normalized["user_id"],
        intent=result["intent"],
        reply_text=result["reply_text"],
        execution=result["execution"],
    )


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

    repo = DatabaseRepository(db)
    user = await repo.get_or_create_user("x", normalized["user_id"])
    history = await repo.get_user_history(user.id)
    await repo.log_dm(user.id, "x", normalized["text"], message_type="user")

    result = await orchestrator.execute(normalized["text"], normalized["user_id"], history=history)
    
    await repo.log_dm(user.id, "x", result["reply_text"], message_type="bot")
    await db.commit()

    return OrchestrationResponse(
        platform="x",
        user_id=normalized["user_id"],
        intent=result["intent"],
        reply_text=result["reply_text"],
        execution=result["execution"],
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
