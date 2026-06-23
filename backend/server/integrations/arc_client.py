"""
arc_client.py — Wrapper para o Circle Payments API (Arc/USDC).

Em sandbox (ARC_SANDBOX=true), todas as operações são simuladas localmente
para permitir demos sem depender do ambiente Circle estar disponível.

Variáveis de ambiente:
    CIRCLE_API_KEY      — API key do Circle
    CIRCLE_WALLET_ID    — ID da wallet de pagamento USDC
    ARC_SANDBOX         — "true" para sandbox (padrão), "false" para produção
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

LOG = logging.getLogger(__name__)

CIRCLE_API_BASE = "https://api.circle.com/v1"
CIRCLE_SANDBOX_BASE = "https://api-sandbox.circle.com/v1"


class ArcClient:
    """Wrapper para o Circle Payments API com suporte a sandbox."""

    def __init__(
        self,
        api_key: str = "",
        wallet_id: str = "",
        sandbox: bool = True,
    ):
        self.api_key = api_key or os.getenv("CIRCLE_API_KEY", "")
        self.wallet_id = wallet_id or os.getenv("CIRCLE_WALLET_ID", "")
        self.sandbox = sandbox
        self.base_url = CIRCLE_SANDBOX_BASE if sandbox else CIRCLE_API_BASE

    # ------------------------------------------------------------------
    # Payments
    # ------------------------------------------------------------------

    async def send_usdc(
        self,
        to_address: str,
        amount_usdc: float,
        idempotency_key: str,
    ) -> str:
        """
        Envia USDC para um endereço via Circle API.
        Retorna o transaction hash.
        idempotency_key deve ser o intent_id (UUID v4) para anti-replay.
        """
        if self.sandbox:
            tx_hash = f"sandbox_tx_{idempotency_key[:16]}"
            LOG.info(
                "[arc] SANDBOX send %.4f USDC → %s | tx=%s",
                amount_usdc,
                to_address,
                tx_hash,
            )
            return tx_hash

        if not self.api_key:
            raise RuntimeError("CIRCLE_API_KEY not configured")

        payload = {
            "idempotencyKey": idempotency_key,
            "source": {"type": "wallet", "id": self.wallet_id},
            "destination": {"type": "blockchain", "address": to_address, "chain": "ETH"},
            "amount": {"amount": f"{amount_usdc:.6f}", "currency": "USD"},
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/transfers",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
            )
            if not resp.is_success:
                raise RuntimeError(
                    f"Circle API error {resp.status_code}: {resp.text[:200]}"
                )
            data = resp.json()

        tx_id = data.get("data", {}).get("id", "")
        LOG.info(
            "[arc] LIVE send %.4f USDC → %s | circle_transfer_id=%s",
            amount_usdc,
            to_address,
            tx_id,
        )
        return tx_id

    # ------------------------------------------------------------------
    # Balance
    # ------------------------------------------------------------------

    async def get_balance(self, wallet_id: Optional[str] = None) -> float:
        """Retorna saldo USDC disponível na wallet."""
        wid = wallet_id or self.wallet_id

        if self.sandbox:
            LOG.info("[arc] SANDBOX balance query wallet=%s → 1000.0 USDC", wid)
            return 1000.0

        if not self.api_key or not wid:
            raise RuntimeError("CIRCLE_API_KEY or CIRCLE_WALLET_ID not configured")

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/wallets/{wid}",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            if not resp.is_success:
                raise RuntimeError(
                    f"Circle API error {resp.status_code}: {resp.text[:200]}"
                )
            data = resp.json()

        balances = data.get("data", {}).get("balances", [])
        usdc_balance = next(
            (float(b["amount"]) for b in balances if b.get("currency") == "USD"),
            0.0,
        )
        return usdc_balance

    # ------------------------------------------------------------------
    # Transfer status
    # ------------------------------------------------------------------

    async def get_transfer_status(self, transfer_id: str) -> dict:
        """Consulta status de uma transferência pelo ID."""
        if self.sandbox:
            return {
                "id": transfer_id,
                "status": "complete",
                "amount": {"amount": "0", "currency": "USD"},
            }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/transfers/{transfer_id}",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            if not resp.is_success:
                raise RuntimeError(
                    f"Circle API error {resp.status_code}: {resp.text[:200]}"
                )
            return resp.json().get("data", {})
