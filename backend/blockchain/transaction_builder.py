import asyncio
from typing import Dict, Optional, Any
from web3 import Web3
from .story_client import StoryClient
from .wallet_manager import WalletManager

class TransactionBuilder:
    def __init__(self, story_client: StoryClient = None):
        self.story_client = story_client or StoryClient()
        self.wallet_manager = WalletManager()
    
    async def build_tx(
        self, 
        from_address: str, 
        to_address: str, 
        amount: float,
        gas_price: int = None
    ) -> Dict[str, Any]:
        
        if not self.story_client.is_connected():
            await self.story_client.connect()
        
        try:
            if not gas_price:
                gas_data = await self.story_client.get_gas_price()
                if not gas_data.get("success"):
                    return {"error": "Gas price failed"}
                gas_price = int(gas_data["gas_price"])
            
            nonce = await self.story_client.get_nonce(from_address)
            wei = Web3.to_wei(amount, 'ether')
            
            transaction = {
                'nonce': nonce,
                'to': to_address,
                'value': wei,
                'gas': 21000,
                'gasPrice': gas_price,
                'chainId': 1513
            }
            
            gas = await self.story_client.estimate_gas({
                'to': to_address,
                'value': wei,
                'from': from_address
            })
            transaction['gas'] = max(gas, 21000)
            
            return {
                "success": True,
                "transaction": transaction,
                "gas": gas
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    async def build_token_tx(
        self,
        from_address: str,
        to_address: str,
        token_address: str,
        amount: int,
        gas_price: int = None
    ) -> Dict[str, Any]:
        
        if not self.story_client.is_connected():
            await self.story_client.connect()
        
        try:
            transfer_sig = "0xa9059cbb"
            to_padded = to_address[2:].zfill(64)
            amount_padded = hex(amount)[2:].zfill(64)
            data = transfer_sig + to_padded + amount_padded
            
            if not gas_price:
                gas_data = await self.story_client.get_gas_price()
                if not gas_data.get("success"):
                    return {"error": "Gas price failed"}
                gas_price = int(gas_data["gas_price"])
            
            nonce = await self.story_client.get_nonce(from_address)
            
            transaction = {
                'nonce': nonce,
                'to': token_address,
                'value': 0,
                'data': data,
                'gas': 65000,
                'gasPrice': gas_price,
                'chainId': 1513
            }
            
            gas = await self.story_client.estimate_gas({
                'to': token_address,
                'value': 0,
                'data': data,
                'from': from_address
            })
            transaction['gas'] = max(gas, 65000)
            
            return {
                "success": True,
                "transaction": transaction,
                "gas": gas
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    async def sign_and_send(
        self, 
        transaction: Dict[str, Any], 
        private_key: str
    ) -> Dict[str, Any]:
        
        try:
            signed_result = self.wallet_manager.sign_transaction(transaction, private_key)
            if not signed_result.get("success"):
                return signed_result
            
            send_result = await self.story_client.send_transaction(
                signed_result["raw_transaction"]
            )
            
            if send_result.get("success"):
                return {
                    "success": True,
                    "tx_hash": send_result["tx_hash"],
                    "explorer_url": send_result["explorer_url"]
                }
            else:
                return send_result
                
        except Exception as e:
            return {"error": str(e)}
    
    async def estimate_cost(
        self,
        from_address: str,
        to_address: str,
        amount: float = 0,
        data: str = None
    ) -> Dict[str, Any]:
        
        try:
            tx_data = {
                'to': to_address,
                'value': Web3.to_wei(amount, 'ether') if amount > 0 else 0,
                'from': from_address
            }
            
            if data:
                tx_data['data'] = data
            
            gas = await self.story_client.estimate_gas(tx_data)
            gas_price_data = await self.story_client.get_gas_price()
            
            if not gas_price_data.get("success"):
                return {"error": "Gas price failed"}
            
            gas_price = int(gas_price_data["gas_price"])
            total_cost_wei = gas * gas_price
            total_cost_eth = Web3.from_wei(total_cost_wei, 'ether')
            
            return {
                "success": True,
                "gas": gas,
                "gas_price": gas_price,
                "total_cost_eth": float(total_cost_eth)
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def validate_tx(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        required = ['nonce', 'to', 'value', 'gas', 'gasPrice', 'chainId']
        
        for field in required:
            if field not in transaction:
                return {"error": f"Missing {field}"}
        
        if not self.wallet_manager.validate_address(transaction['to']):
            return {"error": "Invalid address"}
        
        if transaction['value'] < 0:
            return {"error": "Invalid value"}
        
        if transaction['gas'] < 21000:
            return {"error": "Gas too low"}
        
        return {"success": True} 