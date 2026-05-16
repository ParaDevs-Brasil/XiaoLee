"""
stellar_routes.py — Endpoints diretos de operações Stellar (sem AI intermediária).

GET /stellar/swap/quote — quote + XDR assinável para pathPaymentStrictSend
"""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException, Query

from server.integrations.stellar_adapter import StellarAdapter

LOG = logging.getLogger(__name__)

router = APIRouter(prefix="/stellar", tags=["stellar"])


@router.get("/swap/quote")
async def get_swap_quote(
    wallet: str = Query(..., description="Endereço Stellar G... do usuário"),
    from_asset: str = Query("XLM"),
    to_asset: str = Query("USDC"),
    amount: float = Query(10.0, gt=0),
):
    """
    Consulta o Stellar DEX via Horizon e retorna quote + XDR não assinado.
    O frontend assina o XDR com Freighter e submete ao Horizon.

    Retorna:
        quote.source_amount     — quanto o usuário envia
        quote.destination_amount — quanto o usuário recebe (~, com slippage 1%)
        xdr                     — XDR da transação (None se sem liquidez)
        network_passphrase      — para o signTransaction do Freighter
        has_liquidity           — se há path disponível
    """
    network = os.getenv("STELLAR_NETWORK", "testnet")
    adapter = StellarAdapter(network=network)

    quote = await adapter.prepare_swap(
        wallet=wallet,
        from_asset=from_asset,
        to_asset=to_asset,
        amount=amount,
    )

    xdr = None
    if quote.destination_amount > 0:
        try:
            xdr = await adapter.build_swap_xdr(
                wallet=wallet,
                from_asset=from_asset,
                to_asset=to_asset,
                send_amount=quote.source_amount,
                min_dest_amount=quote.destination_amount * 0.99,
            )
        except Exception as exc:
            LOG.warning("[stellar/swap] build_swap_xdr failed: %s", exc)

    network_passphrase = (
        "Test SDF Network ; September 2015"
        if network == "testnet"
        else "Public Global Stellar Network ; September 2015"
    )

    return {
        "quote": {
            "from": from_asset,
            "to": to_asset,
            "source_amount": quote.source_amount,
            "destination_amount": quote.destination_amount,
            "fee_xlm": quote.fee_xlm,
            "path": quote.path,
        },
        "xdr": xdr,
        "network_passphrase": network_passphrase,
        "has_liquidity": quote.destination_amount > 0,
    }
