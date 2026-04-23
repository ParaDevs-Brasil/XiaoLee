from __future__ import annotations

import os
from dataclasses import dataclass


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
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    solana_rpc_url: str = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
    solana_cluster: str = os.getenv("SOLANA_CLUSTER", "devnet")
    jupiter_quote_url: str = os.getenv(
        "JUPITER_QUOTE_URL", "https://quote-api.jup.ag/v6/quote"
    )
    jupiter_swap_url: str = os.getenv(
        "JUPITER_SWAP_URL", "https://quote-api.jup.ag/v6/swap"
    )

    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_webhook_secret: str = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    x_webhook_secret: str = os.getenv("X_WEBHOOK_SECRET", "")
    x_bearer_token: str = os.getenv("X_BEARER_TOKEN", "")
    x_dm_api_base_url: str = os.getenv("X_DM_API_BASE_URL", "https://api.x.com")
    inbound_rate_limit_per_minute: int = int(os.getenv("INBOUND_RATE_LIMIT_PER_MINUTE", "60"))
    cors_allowed_origins: list[str] = None
    
    helius_api_key: str = os.getenv("HELIUS_API_KEY", "")
    helius_webhook_secret: str = os.getenv("HELIUS_WEBHOOK_SECRET", "")

    def __post_init__(self):
        object.__setattr__(
            self,
            "cors_allowed_origins",
            _parse_csv_env("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
        )


settings = Settings()
