"""
arc_routes.py — Rotas Circle/Arc: wallet info, saldo USDC, bridge CCTP.

Endpoints:
    GET  /v1/arc/wallet          → info da wallet do agente (endereço, saldo)
    POST /v1/arc/cctp/bridge     → inicia bridge USDC de outra chain para Arc
    GET  /v1/arc/cctp/status/{msg_hash} → status de um bridge em andamento

CCTP é protegido por flag CCTP_ENABLED — retorna 503 se desabilitado.
"""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.integrations.arc_client import ArcClient
from server.settings import settings

LOG = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/arc", tags=["arc"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _arc_client() -> ArcClient:
    return ArcClient(
        api_key=settings.circle_api_key,
        wallet_id=settings.circle_wallet_id,
        blockchain=settings.circle_blockchain,
        usdc_token_id=settings.circle_usdc_token_id,
        sandbox=settings.arc_sandbox,
    )


def _cctp_client():
    from server.integrations.cctp_client import CCTPClient
    return CCTPClient(
        source_rpc=settings.cctp_source_rpc,
        arc_rpc=settings.arc_rpc_url,
        signer_key=settings.cctp_signer_private_key,
        sandbox=settings.arc_sandbox,
    )


# ---------------------------------------------------------------------------
# Wallet
# ---------------------------------------------------------------------------


@router.get("/wallet")
async def get_agent_wallet():
    """
    Retorna endereço EVM e saldo USDC da wallet do agente.
    Útil para verificar se o setup Circle está correto antes de rodar campanha.
    """
    arc = _arc_client()
    try:
        info    = await arc.get_wallet_info()
        balance = await arc.get_usdc_balance()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {
        "wallet_id":   arc.wallet_id,
        "address":     info.get("address", ""),
        "blockchain":  info.get("blockchain", arc.blockchain),
        "state":       info.get("state", "UNKNOWN"),
        "usdc_balance": balance,
        "sandbox":     arc.sandbox,
    }


@router.get("/wallet/balance")
async def get_agent_balance():
    """Saldo USDC disponível (rota rápida para o dashboard Traction)."""
    arc = _arc_client()
    try:
        balance = await arc.get_usdc_balance()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {"usdc_balance": balance, "sandbox": arc.sandbox}


# ---------------------------------------------------------------------------
# CCTP bridge
# ---------------------------------------------------------------------------


class BridgeRequest(BaseModel):
    amount_usdc: float
    recipient:   str          # endereço EVM no Arc que receberá o USDC
    source_rpc:  str = ""     # sobrescreve env CCTP_SOURCE_RPC se fornecido


class BridgeResponse(BaseModel):
    source_tx_hash: str
    arc_tx_hash:    str
    amount_usdc:    float
    recipient:      str
    message_hash:   str
    sandbox:        bool


@router.post("/cctp/bridge", response_model=BridgeResponse)
async def cctp_bridge(payload: BridgeRequest):
    """
    Faz bridge de USDC de uma chain EVM para o Arc via CCTP.

    Requer CCTP_ENABLED=true e variáveis de ambiente configuradas.
    Em sandbox (ARC_SANDBOX=true), simula o bridge sem chamadas on-chain.
    """
    if not settings.cctp_enabled and not settings.arc_sandbox:
        raise HTTPException(
            status_code=503,
            detail="CCTP não habilitado. Configure CCTP_ENABLED=true no .env.",
        )

    if payload.amount_usdc <= 0:
        raise HTTPException(status_code=400, detail="amount_usdc deve ser positivo")

    if not payload.recipient or not payload.recipient.startswith("0x"):
        raise HTTPException(status_code=400, detail="recipient deve ser um endereço EVM 0x...")

    cctp = _cctp_client()
    if payload.source_rpc:
        cctp.source_rpc = payload.source_rpc

    try:
        result = await cctp.bridge_usdc_to_arc(
            amount_usdc=payload.amount_usdc,
            recipient=payload.recipient,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc))

    return BridgeResponse(
        source_tx_hash=result.source_tx_hash,
        arc_tx_hash=result.arc_tx_hash,
        amount_usdc=result.amount_usdc,
        recipient=result.recipient,
        message_hash=result.message_hash,
        sandbox=result.sandbox,
    )


@router.get("/cctp/status/{message_hash}")
async def cctp_attestation_status(message_hash: str):
    """
    Consulta o status de attestation Circle para um bridge em andamento.
    Retorna o estado da iris-api (pending | complete) sem aguardar.
    """
    import httpx as _httpx

    iris = (
        "https://iris-api-sandbox.circle.com/v1/attestations"
        if settings.arc_sandbox
        else "https://iris-api.circle.com/v1/attestations"
    )

    try:
        async with _httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{iris}/{message_hash}")
            if resp.status_code == 404:
                return {"status": "pending", "message_hash": message_hash}
            if not resp.is_success:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"iris-api error: {resp.text[:200]}",
                )
            return resp.json() | {"message_hash": message_hash}
    except _httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"iris-api unreachable: {exc}")


# ---------------------------------------------------------------------------
# Healthcheck Circle API
# ---------------------------------------------------------------------------


@router.get("/healthcheck")
async def arc_healthcheck():
    """Valida conectividade com a Circle API e configuração do cliente."""
    arc = _arc_client()

    if arc.sandbox:
        return {
            "ok":       True,
            "sandbox":  True,
            "message":  "ARC_SANDBOX=true — Circle API não é chamada",
            "wallet_id": arc.wallet_id or "(não configurado)",
        }

    if not arc.api_key:
        return {"ok": False, "sandbox": False, "message": "CIRCLE_API_KEY não configurada"}

    try:
        info = await arc.get_wallet_info()
        return {
            "ok":        True,
            "sandbox":   False,
            "address":   info.get("address", ""),
            "state":     info.get("state", "UNKNOWN"),
            "blockchain": info.get("blockchain", arc.blockchain),
        }
    except RuntimeError as exc:
        return {"ok": False, "sandbox": False, "message": str(exc)}
