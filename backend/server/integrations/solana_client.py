from __future__ import annotations

from typing import Any, Dict

import httpx


class SolanaClient:
    def __init__(self, rpc_url: str, jupiter_quote_url: str, jupiter_swap_url: str):
        self.rpc_url = rpc_url
        self.jupiter_quote_url = jupiter_quote_url
        self.jupiter_swap_url = jupiter_swap_url

    async def get_health(self) -> Dict[str, Any]:
        payload = {"jsonrpc": "2.0", "id": 1, "method": "getHealth"}
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(self.rpc_url, json=payload)
            response.raise_for_status()
            return response.json()

    async def get_balance(self, wallet_address: str) -> Dict[str, Any]:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [wallet_address],
        }
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.post(self.rpc_url, json=payload)
            response.raise_for_status()
            data = response.json()

        lamports = data.get("result", {}).get("value", 0)
        sol = lamports / 1_000_000_000
        return {"wallet": wallet_address, "lamports": lamports, "sol": sol}

    async def get_swap_quote(
        self,
        input_mint: str,
        output_mint: str,
        amount_raw: int,
        slippage_bps: int = 50,
    ) -> Dict[str, Any]:
        params = {
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": str(amount_raw),
            "slippageBps": str(slippage_bps),
        }
        async with httpx.AsyncClient(timeout=18) as client:
            response = await client.get(self.jupiter_quote_url, params=params)
            response.raise_for_status()
            return response.json()

    async def prepare_swap_transaction(self, quote_response: Dict[str, Any], user_public_key: str) -> Dict[str, Any]:
        payload = {
            "quoteResponse": quote_response,
            "userPublicKey": user_public_key,
            "wrapAndUnwrapSol": True,
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(self.jupiter_swap_url, json=payload)
            response.raise_for_status()
            return response.json()
