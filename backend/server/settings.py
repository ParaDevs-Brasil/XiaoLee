from __future__ import annotations

import os
from dataclasses import dataclass


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
    inbound_rate_limit_per_minute: int = int(os.getenv("INBOUND_RATE_LIMIT_PER_MINUTE", "60"))
    
    helius_api_key: str = os.getenv("HELIUS_API_KEY", "")
    helius_webhook_secret: str = os.getenv("HELIUS_WEBHOOK_SECRET", "")


settings = Settings()
