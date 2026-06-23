# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XiaoLee is a bilingual (EN/PT) conversational AI assistant for Solana — wallet-first swaps via Jupiter v6, on-chain DeFi campaigns, universal transfers by @handle, in-app notifications, and Telegram/X bot integration. The system is currently on Devnet; mainnet requires an external audit (not yet started).

## Commands

### Setup & Development

```bash
make init          # Full setup: venv + npm + .env from template
make dev           # Start backend (uvicorn :8000) + frontend (next dev :3000) concurrently
make preflight     # init-check + smoke + lint — run before opening a PR
```

### Testing

```bash
# Backend (pytest, 65+ tests)
make test-backend                          # Full suite
make smoke-backend                         # Quick smoke (metrics only)
cd backend && ../.venv/bin/pytest tests/test_<name>.py -q  # Single test file

# Frontend
cd frontend && npm test                    # All tests (Vitest)
cd frontend && npm test -- src/utils/swap.test.ts  # Single test file

# Smart contract
make anchor-test                           # cd solana-program/xiaolee_core && anchor test

# Load tests (Locust)
make load-test-smoke                       # 20 users, 2 min, local
make load-test-staging HOST=<url>          # 100 users, 10 min, staging
```

### Build & Lint

```bash
make lint-quick                            # py_compile + next lint (fast)
cd frontend && npm run lint
cd frontend && npm run build               # Next.js static export check

make ci-local                              # Full CI: backend pytest + frontend lint+test+build
```

### Database (Alembic)

```bash
make db-migrate                            # Apply all pending migrations
make db-status                             # Show current revision and history
make db-rollback                           # Revert last migration
make db-new-migration MSG="description"    # Autogenerate migration after editing models.py
```

### Docker (full stack)

```bash
cp .env.example .env                       # Fill required vars first
make run-docker                            # PostgreSQL + Redis + backend + frontend + Grafana + Prometheus
make stop-docker                           # Stop all containers
make stop-docker-clean                     # Stop and remove volumes
docker compose logs -f xiaolee-core        # Stream backend logs
```

### Solana / Anchor

```bash
make anchor-build                          # Compile Rust program
make anchor-deploy-devnet                  # Deploy to devnet
make anchor-idl-sync                       # Copy IDL to frontend/src/idl/xiaolee_core.json
```

## Architecture

### Services & URLs (local dev)

| Service | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| Backend (FastAPI) | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

### Backend (`backend/`)

FastAPI app with async SQLAlchemy (asyncpg/aiosqlite). Entry point: `backend/server/app.py`.

- **`server/settings.py`** — frozen dataclass `Settings`; all config via env vars. SQLite is the default dev database (no `DATABASE_URL` needed locally); Redis rate limiting is in-memory when `REDIS_URL` is unset.
- **`server/orchestration/service.py`** — `OrchestrationService`: pre-LLM regex intent detection for transfers → falls through to `GeminiClient` for NL intent classification → dispatches to `SolanaClient` / adapters.
- **`server/integrations/`** — one file per external service: `gemini_client.py`, `solana_client.py`, `telegram_client.py`, `x_client.py`, `anchor_client.py`, `helius_client.py`, and `stellar_adapter.py`.
- **`server/campaigns_routes.py`** / **`server/notifications_routes.py`** — FastAPI routers registered in `app.py`.
- **`server/webhooks/`** — Helius webhook routes (HMAC validated).
- **`server/routes/`** — Stellar SEP-10 auth, Stellar payment routes, and x402 (micropayment) routes.
- **`server/rate_limiter.py`** — Redis sliding-window rate limiter with automatic in-memory fallback.
- **`database/models.py`** — SQLAlchemy ORM models; **`database/repository.py`** — all DB access; Alembic migrations in `alembic/`.
- **`backend/tests/`** — pytest suite; `conftest.py` sets up async test DB (SQLite). Run with `-p no:anchorpy` flag (already in `Makefile`).

### Frontend (`frontend/`)

Next.js 14 app (App Router). TypeScript. Vitest for tests.

- **`src/api/api.tsx`** — all backend HTTP calls go here; use `NEXT_PUBLIC_CORE_API_URL` as base URL.
- **`src/contexts/LanguageContext.tsx`** — EN/PT i18n; `t(key)` helper; persisted to `localStorage`. Locale files: `src/locales/en.json` and `pt.json`.
- **`src/hooks/useAuth.tsx`** — Web3Auth (Google OAuth) + Phantom wallet auth; session persisted; fallback by `twitter_user_id`.
- **`src/components/UserData.tsx`** — loads user profile; always guard against empty user ID before calling `fetchData()`.
- **`src/interfaces/`** — TypeScript types must exactly mirror backend Pydantic schemas.
- **`src/idl/xiaolee_core.json`** — Anchor IDL; regenerate with `make anchor-idl-sync` after contract changes.
- **`src/app/`** — App Router pages: `campaigns/`, `dashboard/`, `notifications/`, `landing/`.

### Solana Program (`solana-program/xiaolee_core/`)

Anchor (Rust) program on Devnet. Program ID: `Fmmpn79Tij8fzYHg31ekZz4MmK9ArGzN59VogfcwhXiM`.

Instructions: `initialize_global`, `initialize_user`, `record_swap`, `pause_protocol`, `unpause_protocol`, `transfer_admin`.

PDAs: `global_config` and `user_state`. Emergency pause is implemented on-chain.

### Key Data Flows

**Swap (wallet-first):** Frontend → `POST /v1/solana/swap/prepare` → Jupiter v6 quote + unsigned tx → frontend simulates → user signs with Phantom → Helius webhook fires on confirmation → `AnchorClient.record_swap()` writes on-chain.

**Campaigns:** `POST /campaigns/join` (409 idempotent) → `POST /campaigns/verify` → `POST /campaigns/claim` with ED25519 proof signature → reward notification persisted in-app.

**Chat:** `POST /chat` → pre-LLM regex checks for transfer intent → if not matched, `GeminiClient` classifies and responds in user's language (auto PT/EN mirroring).

**Inbound messages (Telegram/X):** validated by HMAC/secret token → `OrchestrationService` → same intent pipeline as chat.

## Development Rules

### Backend

- New routes go in separate `*_routes.py` files; register the router in `server/app.py`.
- Use Pydantic v2 with strict types for all schemas.
- Apply rate limiting on new inbound endpoints: `await _enforce_rate_limit_async(key)`.
- When `DATABASE_URL` is unset, the app uses SQLite (`aiosqlite`); always support both.

### Frontend

- API calls: `src/api/api.tsx` only — no direct `fetch`/`axios` calls in components.
- Validate user ID is non-empty before any fetch (see `UserData.fetchData()` pattern).
- Campaign status enum: `enrolled | tasks_verified | paid` — use these exact strings.
- Handle `HTTP 409 Conflict` on join as `alreadyJoined: true`, not as an error.
- Add new i18n strings to both `src/locales/en.json` and `src/locales/pt.json`.

### Smart Contract

- Never use `.unwrap()` in arithmetic — always `checked_add` / `ok_or(ErrorCode::...)`.
- New instructions require strict `has_one = admin` verification.
- Follow CEI pattern: Checks → Effects → Interactions.
- After any contract rebuild, run `make anchor-idl-sync` to keep the frontend IDL in sync.

## Deployment

Deployed on Railway (backend) and Render (frontend). `railway.toml` and `render.yaml` are at the repo root. `railway.landing.toml` is for the isolated landing page service.

Required env vars: `GEMINI_API_KEY`, `HELIUS_API_KEY`, `HELIUS_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `X_WEBHOOK_SECRET`, `NEXT_PUBLIC_CORE_API_URL`, `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`.

On Railway, set `TELEGRAM_POLLER_ENABLED=false` if a local Docker instance owns the bot session to avoid conflicts.

After deploying the frontend, add its URL to `CORS_ALLOWED_ORIGINS` on the backend service.
