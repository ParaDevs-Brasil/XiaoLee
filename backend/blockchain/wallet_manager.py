import os
from eth_account import Account
from typing import Dict, Any, Optional


class WalletManager:

    def __init__(self):
        pass

    def create_wallet(self) -> Dict[str, Any]:
        """Creates a new Ethereum account."""
        try:
            account = Account.create()
            return {
                "success": True,
                "address": account.address,
                "private_key": account.key.hex()
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def sign_transaction(self, transaction: Dict[str, Any],
                         private_key: str) -> Dict[str, Any]:
        """Signs a transaction with a given private key."""
        try:
            account = Account.from_key(private_key)
            signed = account.sign_transaction(transaction)

            return {
                "success": True,
                "raw_transaction": signed.rawTransaction.hex(),
                "hash": signed.hash.hex()
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_address_from_private_key(self, private_key: str) -> Optional[str]:
        """Derives a public address from a private key."""
        try:
            account = Account.from_key(private_key)
            return account.address
        except Exception:
            return None

    def validate_address(self, address: str) -> bool:
        """Validates if a string is a plausible Ethereum address."""
        return isinstance(
            address, str) and len(address) == 42 and address.startswith("0x")

    def validate_private_key(self, private_key: str) -> bool:
        """Validates if a string is a plausible private key."""
        try:
            Account.from_key(private_key)
            return True
        except Exception:
            return False
