from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=False))


def _parse_csv_env(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    items = [part.strip() for part in raw.split(",") if part.strip()]
    return items or [default]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("XIAOLEE_APP_NAME", "XiaoLee Core API")
    app_version: str = os.getenv("XIAOLEE_APP_VERSION", "2.0.0-mvp")
    environment: str = os.getenv("XIAOLEE_ENV", "dev")

    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    solana_rpc_url: str = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
    solana_cluster: str = os.getenv("SOLANA_CLUSTER", "devnet")
    jupiter_quote_url: str = os.getenv(
        "JUPITER_QUOTE_URL", "https://quote-api.jup.ag/v6/quote"
    )
    jupiter_swap_url: str = os.getenv(
        "JUPITER_SWAP_URL", "https://quote-api.jup.ag/v6/swap"
    )

    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_bot_name: str = os.getenv("TELEGRAM_BOT_NAME", "")
    telegram_webhook_secret: str = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    # Set TELEGRAM_POLLER_ENABLED=false on Railway to disable long-polling there
    # and let only the local Docker instance own the bot session.
    telegram_poller_enabled: bool = os.getenv("TELEGRAM_POLLER_ENABLED", "true").lower() not in ("false", "0", "no")
    x_webhook_secret: str = os.getenv("X_WEBHOOK_SECRET", "")
    x_bearer_token: str = os.getenv("X_BEARER_TOKEN", "")
    x_dm_api_base_url: str = os.getenv("X_DM_API_BASE_URL", "https://api.x.com")
    inbound_rate_limit_per_minute: int = int(os.getenv("INBOUND_RATE_LIMIT_PER_MINUTE", "60"))
    cors_allowed_origins: list[str] = None
    cors_allowed_origin_regex: str = ""
    
    helius_api_key: str = os.getenv("HELIUS_API_KEY", "")
    helius_webhook_secret: str = os.getenv("HELIUS_WEBHOOK_SECRET", "")

    # Chave privada do admin do protocolo (base58) para assinar transacoes Anchor.
    solana_admin_keypair_b58: str = os.getenv("SOLANA_ADMIN_KEYPAIR_B58", "")

    # Redis para rate limiting persistente.
    # Se nao definida, o rate limiter usa in-memory (nao persiste entre restarts).
    # Producao: redis://user:pass@host:6379/0  ou  rediss:// para TLS
    redis_url: str = os.getenv("REDIS_URL", "")

    # ── Stellar ──────────────────────────────────────────────────────────────────
    stellar_network: str = os.getenv("STELLAR_NETWORK", "testnet")
    stellar_horizon_url: str = os.getenv("STELLAR_HORIZON_URL", "")
    # Keypair do servidor para challenges SEP-10 (nunca usado para fundos)
    stellar_server_secret: str = os.getenv("STELLAR_SERVER_SECRET", "")
    stellar_home_domain: str = os.getenv("STELLAR_HOME_DOMAIN", "xiaolee.io")
    # Carteira que recebe micropagamentos x402
    stellar_x402_wallet: str = os.getenv("STELLAR_X402_WALLET", "")
    stellar_x402_price_xlm: float = float(os.getenv("STELLAR_X402_PRICE_XLM", "0.5"))
    stellar_x402_enabled: bool = os.getenv("STELLAR_X402_ENABLED", "true").lower() == "true"

    # Headers CORS permitidos.
    cors_allowed_headers: list[str] = None

    # ── Traction / RFB-06 ────────────────────────────────────────────────────
    # Shared secret entre o agente Arc (f0ntz) e este backend.
    # Se vazio, o endpoint aceita sem autenticação (dev only).
    arc_payment_secret: str = os.getenv("ARC_PAYMENT_SECRET", "")

    def __post_init__(self):
        object.__setattr__(
            self,
            "cors_allowed_origins",
            _parse_csv_env("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
        )
        cors_origin_regex = os.getenv("CORS_ALLOWED_ORIGIN_REGEX", "")
        if not cors_origin_regex and self.environment == "dev":
            cors_origin_regex = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
        object.__setattr__(self, "cors_allowed_origin_regex", cors_origin_regex)
        # Headers CORS: em producao, restringir a lista minima necessaria.
        # Por padrao aceita os headers padrao REST + Authorization.
        cors_headers_default = "Content-Type,Authorization,Accept,X-Requested-With,X-Payment,X-Payment-Required,X-Arc-Secret"
        object.__setattr__(
            self,
            "cors_allowed_headers",
            _parse_csv_env("CORS_ALLOWED_HEADERS", cors_headers_default),
        )


settings = Settings()
