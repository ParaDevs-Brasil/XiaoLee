import asyncio
import time
from typing import Dict, Optional, Any, List
from .story_client import StoryClient

class TransactionMonitor:
    def __init__(self, story_client: StoryClient = None):
        self.story_client = story_client or StoryClient()
        self.monitoring_tasks = {}
    
    async def wait_tx(
        self, 
        tx_hash: str, 
        timeout: int = 300
    ) -> Dict[str, Any]:
        
        if not self.story_client.is_connected():
            await self.story_client.connect()
        
        start_time = time.time()
        confirmed_blocks = 0
        
        try:
            while time.time() - start_time < timeout:
                tx_result = await self.story_client.get_transaction(tx_hash)
                
                if not tx_result.get("success"):
                    await asyncio.sleep(5)
                    continue
                
                receipt = tx_result.get("receipt")
                if not receipt:
                    await asyncio.sleep(5)
                    continue
                
                if receipt.get("status") == 1:
                    current_block = await self.story_client.get_block_number()
                    tx_block = receipt.get("blockNumber", 0)
                    confirmed_blocks = current_block - tx_block + 1
                    
                    return {
                        "success": True,
                        "status": "confirmed",
                        "confirmations": confirmed_blocks,
                        "tx_hash": tx_hash,
                        "block_number": tx_block
                    }
                elif receipt.get("status") == 0:
                    return {
                        "success": False,
                        "status": "failed",
                        "tx_hash": tx_hash,
                        "error": "TX failed"
                    }
                
                await asyncio.sleep(5)
            
            return {
                "success": False,
                "status": "timeout",
                "tx_hash": tx_hash,
                "error": f"Timeout after {timeout}s"
            }
            
        except Exception as e:
            return {
                "success": False,
                "status": "error",
                "tx_hash": tx_hash,
                "error": str(e)
            }
    
    async def get_tx_status(self, tx_hash: str) -> Dict[str, Any]:
        try:
            if not self.story_client.is_connected():
                await self.story_client.connect()
            
            tx_result = await self.story_client.get_transaction(tx_hash)
            
            if not tx_result.get("success"):
                return {"error": "TX not found"}
            
            receipt = tx_result.get("receipt")
            
            if not receipt:
                return {
                    "status": "pending",
                    "tx_hash": tx_hash,
                    "confirmations": 0
                }
            
            current_block = await self.story_client.get_block_number()
            tx_block = receipt.get("blockNumber", 0)
            confirmations = current_block - tx_block + 1
            
            status = "confirmed" if receipt.get("status") == 1 else "failed"
            
            return {
                "status": status,
                "tx_hash": tx_hash,
                "block_number": tx_block,
                "confirmations": confirmations,
                "success": status == "confirmed"
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    async def monitor_multiple(
        self, 
        tx_hashes: List[str],
        timeout: int = 300
    ) -> Dict[str, Dict[str, Any]]:
        
        tasks = []
        for tx_hash in tx_hashes:
            task = asyncio.create_task(
                self.wait_tx(tx_hash, timeout)
            )
            tasks.append((tx_hash, task))
        
        results = {}
        for tx_hash, task in tasks:
            try:
                result = await task
                results[tx_hash] = result
            except Exception as e:
                results[tx_hash] = {
                    "success": False,
                    "error": str(e)
                }
        
        return results
    
    async def start_monitoring(
        self, 
        tx_hash: str,
        callback = None,
        timeout: int = 300
    ) -> str:
        
        task_id = f"monitor_{tx_hash}_{int(time.time())}"
        
        async def monitor_task():
            result = await self.wait_tx(tx_hash, timeout)
            if callback:
                try:
                    await callback(tx_hash, result)
                except Exception:
                    pass
            
            if task_id in self.monitoring_tasks:
                del self.monitoring_tasks[task_id]
        
        self.monitoring_tasks[task_id] = asyncio.create_task(monitor_task())
        return task_id
    
    async def stop_monitoring(self, task_id: str) -> bool:
        if task_id in self.monitoring_tasks:
            task = self.monitoring_tasks[task_id]
            task.cancel()
            del self.monitoring_tasks[task_id]
            return True
        return False
    
    def get_active_monitors(self) -> List[str]:
        return list(self.monitoring_tasks.keys())
    
    async def cleanup_monitors(self) -> int:
        completed = []
        for task_id, task in self.monitoring_tasks.items():
            if task.done():
                completed.append(task_id)
        
        for task_id in completed:
            del self.monitoring_tasks[task_id]
        
        return len(completed) 