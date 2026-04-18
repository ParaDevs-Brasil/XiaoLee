import os
import asyncio
from typing import Dict, List, Optional, Any
from web3 import Web3
from web3.exceptions import TransactionNotFound
import httpx

class StoryClient:
    def __init__(self, rpc_url: str = None):
        self.rpc_urls = rpc_url or [
            "https://mainnet.storyrpc.io",
            "https://rpc.story.foundation",
            "https://story-rpc.api.onfinality.io/public"
        ]
        
        if isinstance(self.rpc_urls, str):
            self.rpc_urls = [self.rpc_urls]
        
        self.w3 = None
        self.current_rpc = None
        self.chain_id = 1513
        
    async def connect(self) -> bool:
        for rpc_url in self.rpc_urls:
            try:
                self.w3 = Web3(Web3.HTTPProvider(rpc_url))
                
                if self.w3.is_connected():
                    chain_id = await self._chain_id()
                    if chain_id == self.chain_id:
                        self.current_rpc = rpc_url
                        return True
            except Exception:
                continue
        
        return False
    
    async def _chain_id(self) -> int:
        try:
            return await asyncio.to_thread(lambda: self.w3.eth.chain_id)
        except Exception:
            return 0
    
    async def get_balance(self, address: str) -> Dict[str, Any]:
        if not self.w3:
            return {"error": "Not connected"}
        
        try:
            balance_wei = await asyncio.to_thread(
                lambda: self.w3.eth.get_balance(address)
            )
            balance_eth = self.w3.from_wei(balance_wei, 'ether')
            
            return {
                "success": True,
                "balance": float(balance_eth),
                "address": address
            }
        except Exception as e:
            return {"error": f"Balance error: {e}"}
    
    async def get_gas_price(self) -> Dict[str, Any]:
        if not self.w3:
            return {"error": "Not connected"}
        
        try:
            gas_price = await asyncio.to_thread(lambda: self.w3.eth.gas_price)
            return {
                "success": True,
                "gas_price": str(gas_price),
                "gas_price_gwei": float(self.w3.from_wei(gas_price, 'gwei'))
            }
        except Exception as e:
            return {"error": f"Gas error: {e}"}
    
    async def get_nonce(self, address: str) -> int:
        if not self.w3:
            return 0
        
        try:
            return await asyncio.to_thread(
                lambda: self.w3.eth.get_transaction_count(address)
            )
        except Exception:
            return 0
    
    async def send_transaction(self, signed_tx: str) -> Dict[str, Any]:
        if not self.w3:
            return {"error": "Not connected"}
        
        try:
            tx_hash = await asyncio.to_thread(
                lambda: self.w3.eth.send_raw_transaction(signed_tx)
            )
            
            return {
                "success": True,
                "tx_hash": tx_hash.hex(),
                "explorer_url": f"https://storyscan.xyz/tx/{tx_hash.hex()}"
            }
        except Exception as e:
            return {"error": f"TX failed: {e}"}
    
    async def get_transaction(self, tx_hash: str) -> Dict[str, Any]:
        if not self.w3:
            return {"error": "Not connected"}
        
        try:
            tx = await asyncio.to_thread(
                lambda: self.w3.eth.get_transaction(tx_hash)
            )
            
            receipt = None
            try:
                receipt = await asyncio.to_thread(
                    lambda: self.w3.eth.get_transaction_receipt(tx_hash)
                )
            except TransactionNotFound:
                pass
            
            return {
                "success": True,
                "transaction": dict(tx) if tx else None,
                "receipt": dict(receipt) if receipt else None,
                "status": "confirmed" if receipt else "pending"
            }
        except Exception as e:
            return {"error": f"TX error: {e}"}
    
    async def estimate_gas(self, transaction: Dict[str, Any]) -> int:
        if not self.w3:
            return 21000
        
        try:
            return await asyncio.to_thread(
                lambda: self.w3.eth.estimate_gas(transaction)
            )
        except Exception:
            return 21000
    
    async def get_block_number(self) -> int:
        if not self.w3:
            return 0
        
        try:
            return await asyncio.to_thread(lambda: self.w3.eth.block_number)
        except Exception:
            return 0
    
    def is_connected(self) -> bool:
        return self.w3 is not None and self.w3.is_connected()
    
    def get_current_rpc(self) -> str:
        return self.current_rpc
    
    def web3_instance(self) -> Web3:
        return self.w3 