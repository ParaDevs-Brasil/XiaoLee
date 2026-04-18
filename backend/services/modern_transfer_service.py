"""
Modern Transfer Service

Provides modern transfer functionality using Twitter IDs as primary identifiers.
Handles automatic handle resolution and pending transfer management.
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from database.models import User, PendingTransfer, TransactionHistory
from .twitter_api_service import TwitterAPIService, UserHandleService
from swaps.balance_manager import BalanceManager

logger = logging.getLogger(__name__)

class ModernTransferService:
    """Modern transfer service using Twitter IDs as primary identifiers"""
    
    def __init__(self):
        self.twitter_api = TwitterAPIService()
        self.handle_service = UserHandleService(self.twitter_api)
        # Note: We'll use direct SQL operations for balance management since we have sessions
    
    async def _get_balance(self, session: AsyncSession, user_id: str, token: str) -> float:
        """Get user balance for a token"""
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT balance FROM tokenbalances WHERE user_id = :user_id AND token_symbol = :token"),
            {"user_id": user_id, "token": token}
        )
        row = result.fetchone()
        return float(row[0]) if row else 0.0
    
    async def _add_balance(self, session: AsyncSession, user_id: str, token: str, amount: float):
        """Add to user balance"""
        from sqlalchemy import text
        # Ensure amount is float for SQLite compatibility
        amount = float(amount)
        
        # Check if balance exists
        result = await session.execute(
            text("SELECT id, balance FROM tokenbalances WHERE user_id = :user_id AND token_symbol = :token"),
            {"user_id": user_id, "token": token}
        )
        existing = result.fetchone()
        
        if existing:
            # Update existing balance with timestamp
            from datetime import datetime
            new_balance = float(existing[1]) + amount
            await session.execute(
                text("UPDATE tokenbalances SET balance = :balance, updated_at = :updated_at WHERE id = :id"),
                {"balance": new_balance, "id": existing[0], "updated_at": datetime.now()}
            )
        else:
            # Insert new balance record with timestamp
            from datetime import datetime
            now = datetime.now()
            await session.execute(
                text("INSERT INTO tokenbalances (user_id, token_symbol, balance, created_at, updated_at) VALUES (:user_id, :token, :balance, :created_at, :updated_at)"),
                {"user_id": user_id, "token": token, "balance": amount, "created_at": now, "updated_at": now}
            )
    
    async def _subtract_balance(self, session: AsyncSession, user_id: str, token: str, amount: float):
        """Subtract from user balance"""
        from sqlalchemy import text
        from datetime import datetime
        # Ensure amount is float for SQLite compatibility
        amount = float(amount)
        
        result = await session.execute(
            text("SELECT id, balance FROM tokenbalances WHERE user_id = :user_id AND token_symbol = :token"),
            {"user_id": user_id, "token": token}
        )
        existing = result.fetchone()
        
        if existing:
            new_balance = float(existing[1]) - amount
            await session.execute(
                text("UPDATE tokenbalances SET balance = :balance, updated_at = :updated_at WHERE id = :id"),
                {"balance": max(0.0, new_balance), "id": existing[0], "updated_at": datetime.now()}  # Prevent negative balances
            )
    
    async def _resolve_recipient_with_enhanced_logic(self, session: AsyncSession, recipient_identifier: str) -> Optional[str]:
        """Enhanced recipient resolution - checks local database first, then Twitter API"""
        
        logger.info(f"🔍 Enhanced resolution for: {recipient_identifier}")
        
        # Clean and normalize the identifier (case-insensitive)
        clean_identifier = recipient_identifier.strip().replace('@', '').lower()
        
        # 1. Check local database for exact handle match
        try:
            # Create handle variations (all lowercase for case-insensitive search)
            handle_variations = [
                f"@{clean_identifier}",           # @nickname
                clean_identifier,                 # nickname
            ]
            
            logger.info(f"🔍 Checking local database for handle variations: {handle_variations}")
            
            # Search using LOWER() for case-insensitive comparison
            for handle_variant in handle_variations:
                # Search with case-insensitive comparison using func.lower()
                from sqlalchemy import func
                result = await session.execute(
                    select(User).where(
                        func.lower(User.twitter_handle) == handle_variant.lower()
                    )
                )
                user = result.scalar_one_or_none()
                
                if user:
                    logger.info(f"✅ Found user in local database: {user.twitter_handle} (ID: {user.twitter_user_id})")
                    return user.twitter_user_id
                    
            # 2. Check if identifier is already a Twitter user ID (numeric)
            if clean_identifier.isdigit():
                logger.info(f"🔍 Identifier appears to be a Twitter user ID: {clean_identifier}")
                return clean_identifier
                
        except Exception as e:
            logger.error(f"❌ Error checking local database: {e}")
        
        # 3. Fall back to Twitter API resolution
        logger.info(f"🔍 Attempting Twitter API resolution for: {recipient_identifier}")
        try:
            resolved_id = await self.handle_service.resolve_recipient_id(recipient_identifier)
            if resolved_id:
                logger.info(f"✅ Twitter API resolved: {recipient_identifier} → {resolved_id}")
                return resolved_id
        except Exception as e:
            logger.error(f"❌ Twitter API resolution failed: {e}")
        
        logger.warning(f"❌ Could not resolve recipient: {recipient_identifier}")
        return None

    async def transfer_tokens(
        self,
        session: AsyncSession,
        sender_twitter_user_id: str,
        recipient_identifier: str,
        amount: float,
        token_symbol: str = "IP",
        expires_hours: int = 168  # 7 days default
    ) -> Dict[str, Any]:
        """
        Transfer tokens using modern ID-based system
        
        Args:
            session: Database session
            sender_twitter_user_id: Sender's Twitter user ID
            recipient_identifier: Recipient handle (@username) or Twitter user ID
            amount: Amount to transfer
            token_symbol: Token symbol (default: IP)
            expires_hours: Hours until pending transfer expires
            
        Returns:
            Result dictionary with success status and details
        """
        logger.info(f"Processing transfer: {sender_twitter_user_id} → {recipient_identifier} ({amount} {token_symbol})")
        
        try:
            # Get sender user
            sender_result = await session.execute(
                select(User).where(User.twitter_user_id == sender_twitter_user_id)
            )
            sender = sender_result.scalar_one_or_none()
            
            if not sender:
                return {"success": False, "error": f"Sender not found: {sender_twitter_user_id}"}
            
            # Check sender balance using direct SQL
            sender_balance = await self._get_balance(session, sender.twitter_user_id, token_symbol)
            if sender_balance < amount:
                return {
                    "success": False,
                    "error": f"Insufficient balance. Available: {sender_balance}, Required: {amount}"
                }
            
            # Attempt to resolve recipient identifier to Twitter user ID using enhanced logic
            recipient_twitter_id = await self._resolve_recipient_with_enhanced_logic(session, recipient_identifier)
            
            if not recipient_twitter_id:
                # If we can't resolve the recipient, create a pending transfer
                # This handles case 3: User doesn't exist in system → Pending transfer
                logger.info(f"Could not resolve recipient '{recipient_identifier}', creating pending transfer")
                
                # Use the identifier as-is for pending transfer
                clean_handle = recipient_identifier.lstrip('@')
                
                # Create pending transfer
                pending_transfer = PendingTransfer(
                    from_twitter_user_id=sender_twitter_user_id,
                    from_twitter_handle=sender.twitter_handle,
                    recipient_twitter_handle=clean_handle,
                    token_symbol=token_symbol,
                    amount=amount,
                    status='pending'
                )
                
                session.add(pending_transfer)
                
                # Deduct from sender
                await self._subtract_balance(session, sender.twitter_user_id, token_symbol, amount)
                
                # Create transaction history
                transaction = TransactionHistory(
                    user_id=sender.id,
                    transaction_type="pending_transfer", 
                    token_symbol=token_symbol,
                    amount=amount,
                    tx_hash=f"pending_{datetime.now().timestamp()}",
                    status="pending",
                    sender_twitter_handle=sender.twitter_handle,
                    recipient_twitter_handle=clean_handle
                )
                session.add(transaction)
                
                await session.commit()
                
                return {
                    "success": True,
                    "response_code": "TRANSFER_SUCCESS_PENDING",
                    "message": f"Transfer pending - {amount} {token_symbol} will be delivered when @{clean_handle} creates a wallet",
                    "transfer_type": "pending",
                    "transfer_id": pending_transfer.id if hasattr(pending_transfer, 'id') else None,
                    "context": {
                        "amount": amount,
                        "token": token_symbol,
                        "recipient": clean_handle
                    }
                }
            
            # Check if recipient exists in our system
            recipient_result = await session.execute(
                select(User).where(User.twitter_user_id == recipient_twitter_id)
            )
            recipient = recipient_result.scalar_one_or_none()
            
            # Get recipient handle for display
            recipient_handle = recipient_identifier.lstrip('@') if recipient_identifier.startswith('@') else None
            if not recipient_handle:
                # Get handle from Twitter API
                twitter_data = await self.twitter_api.get_user_by_id(recipient_twitter_id)
                recipient_handle = twitter_data['username'] if twitter_data else recipient_twitter_id
            
            if recipient:
                # Check if recipient has a wallet - only do direct transfer if they have one
                from database.models import Wallet
                from sqlalchemy import select as sqlalchemy_select
                
                wallet_result = await session.execute(
                    sqlalchemy_select(Wallet).where(Wallet.user_id == recipient.id)
                )
                recipient_wallet = wallet_result.scalar_one_or_none()
                
                if recipient_wallet:
                    # Direct transfer to existing user with wallet
                    logger.info(f"Direct transfer to existing user @{recipient.twitter_handle} (has wallet)")
                    
                    # Deduct from sender using direct SQL
                    await self._subtract_balance(session, sender.twitter_user_id, token_symbol, amount)
                    
                    # Add to recipient using direct SQL
                    await self._add_balance(session, recipient.twitter_user_id, token_symbol, amount)
                    
                    # Create transaction history for sender
                    sender_transaction = TransactionHistory(
                        user_id=sender.id,
                        transaction_type="transfer",
                        token_symbol=token_symbol,
                        amount=amount,
                        tx_hash=f"direct_{datetime.now().timestamp()}",
                        status="completed",
                        sender_twitter_handle=sender.twitter_handle,
                        recipient_twitter_handle=recipient.twitter_handle
                    )
                    session.add(sender_transaction)
                    
                    # Create transaction history for recipient
                    recipient_transaction = TransactionHistory(
                        user_id=recipient.id,
                        transaction_type="receive_direct",
                        token_symbol=token_symbol,
                        amount=amount,
                        tx_hash=f"receive_{datetime.now().timestamp()}",
                        status="completed",
                        sender_twitter_handle=sender.twitter_handle,
                        recipient_twitter_handle=recipient.twitter_handle
                    )
                    session.add(recipient_transaction)
                    
                    await session.commit()
                    
                    logger.info(f"Direct transfer completed: {amount} {token_symbol}")
                    
                    return {
                        "success": True,
                        "type": "direct",
                        "recipient": f"@{recipient.twitter_handle}",
                        "amount": amount,
                        "token_symbol": token_symbol,
                        "transaction_id": sender_transaction.id
                    }
                else:
                    # User exists but has no wallet - create pending transfer
                    logger.info(f"Creating pending transfer for user @{recipient.twitter_handle} (no wallet)")
                    
                    expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
                    
                    pending = PendingTransfer(
                        from_twitter_user_id=sender.twitter_user_id,
                        from_twitter_handle=sender.twitter_handle,
                        recipient_twitter_handle=recipient.twitter_handle,
                        token_symbol=token_symbol,
                        amount=amount,
                        status="pending"
                    )
                    
                    # Deduct from sender using direct SQL
                    await self._subtract_balance(session, sender.twitter_user_id, token_symbol, amount)
                    
                    session.add(pending)
                    await session.commit()
                    
                    logger.info(f"Pending transfer created: {amount} {token_symbol} for @{recipient.twitter_handle} (user exists but no wallet)")
                    
                    return {
                        "success": True,
                        "type": "pending",
                        "recipient": f"@{recipient.twitter_handle}",
                        "amount": amount,
                        "token_symbol": token_symbol,
                        "message": f"Transfer sent to @{recipient.twitter_handle}. They need to create a wallet to claim it.",
                        "pending_transfer_id": pending.id
                    }
            
            else:
                # Create pending transfer
                logger.info(f"Creating pending transfer for unregistered user: {recipient_handle}")
                
                expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
                
                pending = PendingTransfer(
                    from_twitter_user_id=sender.twitter_user_id,
                    from_twitter_handle=sender.twitter_handle,
                    recipient_twitter_handle=recipient_handle,
                    token_symbol=token_symbol,
                    amount=amount,
                    status="pending"
                )
                
                # Deduct from sender using direct SQL
                await self._subtract_balance(session, sender.twitter_user_id, token_symbol, amount)
                
                session.add(pending)
                await session.commit()
                
                logger.info(f"Pending transfer created: {amount} {token_symbol} for @{recipient_handle}")
                
                return {
                    "success": True,
                    "type": "pending",
                    "recipient": f"@{recipient_handle}",
                    "amount": amount,
                    "token_symbol": token_symbol,
                    "expires_at": expires_at.isoformat(),
                    "message": f"Transfer pending for @{recipient_handle}. They can claim it by registering."
                }
        
        except Exception as e:
            logger.error(f"Transfer failed: {e}")
            await session.rollback()
            return {"success": False, "error": f"Transfer failed: {str(e)}"}
    
    async def claim_pending_transfers(
        self,
        session: AsyncSession,
        user_twitter_id: str
    ) -> List[PendingTransfer]:
        """
        Claim all pending transfers for a user
        
        Args:
            session: Database session
            user_twitter_id: User's Twitter user ID
            
        Returns:
            List of claimed transfers
        """
        logger.info(f"Claiming pending transfers for user: {user_twitter_id}")
        
        try:
            # Get the user
            user_result = await session.execute(
                select(User).where(User.twitter_user_id == user_twitter_id)
            )
            user = user_result.scalar_one_or_none()
            
            if not user:
                logger.warning(f"User not found: {user_twitter_id}")
                return []
            
            # Find pending transfers by current Twitter handle
            pending_result = await session.execute(
                select(PendingTransfer).where(
                    and_(
                        PendingTransfer.recipient_twitter_handle == user.twitter_handle,
                        PendingTransfer.status == "pending"
                    )
                )
            )
            
            pending_transfers = pending_result.scalars().all()
            claimed_transfers = []
            total_claimed = 0.0
            
            for transfer in pending_transfers:
                logger.info(f"Claiming transfer: {transfer.amount} {transfer.token_symbol} from @{transfer.from_twitter_handle}")
                
                # Convert amount to float for SQLite compatibility
                amount_float = float(transfer.amount)
                
                # Add to user balance using direct SQL
                await self._add_balance(session, user.twitter_user_id, transfer.token_symbol, amount_float)
                total_claimed += amount_float
                
                # Update transfer status
                transfer.status = "claimed"
                transfer.claimed_by_user_id = user_twitter_id
                transfer.claimed_at = datetime.now(timezone.utc)
                
                # Create transaction history for recipient
                transaction = TransactionHistory(
                    user_id=user.id,
                    transaction_type="pending_claim",
                    token_symbol=transfer.token_symbol,
                    amount=transfer.amount,
                    tx_hash=f"claim_{transfer.id}_{datetime.now().timestamp()}",
                    status="completed",
                    sender_twitter_handle=transfer.from_twitter_handle,
                    recipient_twitter_handle=user.twitter_handle
                )
                
                session.add(transaction)
                
                # FIXED: Also create transaction history for sender (completion notification)
                sender_result = await session.execute(
                    select(User).where(User.twitter_user_id == transfer.from_twitter_user_id)
                )
                sender_user = sender_result.scalar_one_or_none()
                if sender_user:
                    sender_transaction = TransactionHistory(
                        user_id=sender_user.id,
                        transaction_type="transfer_completed",
                        token_symbol=transfer.token_symbol,
                        amount=transfer.amount,
                        tx_hash=f"claim_{transfer.id}_{datetime.now().timestamp()}",
                        status="completed",
                        sender_twitter_handle=transfer.from_twitter_handle,
                        recipient_twitter_handle=user.twitter_handle
                    )
                    session.add(sender_transaction)
                
                claimed_transfers.append(transfer)
            
            if claimed_transfers:
                # Don't commit here - let the caller handle the transaction
                # The caller (user registration) manages the session lifecycle
                logger.info(f"Successfully claimed {len(claimed_transfers)} transfers totaling {total_claimed} tokens")
            
            return claimed_transfers
        
        except Exception as e:
            logger.error(f"Error claiming transfers: {e}")
            # Don't rollback either - let the caller handle transaction rollback
            raise
    
    async def get_pending_transfers_for_user(
        self,
        session: AsyncSession,
        user_twitter_id: str,
        include_handle_lookup: bool = True
    ) -> List[PendingTransfer]:
        """
        Get all pending transfers for a user
        
        Args:
            session: Database session  
            user_twitter_id: User's Twitter user ID
            include_handle_lookup: Whether to also search by current handle
            
        Returns:
            List of pending transfers
        """
        conditions = [
            PendingTransfer.status == "pending"
        ]
        
        if include_handle_lookup:
            # Get user's current handle
            user_result = await session.execute(
                select(User.twitter_handle).where(User.twitter_user_id == user_twitter_id)
            )
            user_handle = user_result.scalar_one_or_none()
            
            if user_handle:
                conditions.append(PendingTransfer.recipient_twitter_handle == user_handle)
            else:
                # No user handle found, return empty
                return []
        else:
            # Without handle lookup, we can't find transfers since we only store handles
            return []
        
        result = await session.execute(
            select(PendingTransfer).where(and_(*conditions))
        )
        
        return list(result.scalars().all())
    
    async def cancel_pending_transfer(
        self,
        session: AsyncSession,
        transfer_id: int,
        sender_twitter_user_id: str
    ) -> Dict[str, Any]:
        """
        Cancel a pending transfer and refund the sender
        
        Args:
            session: Database session
            transfer_id: Transfer ID to cancel
            sender_twitter_user_id: Sender's Twitter user ID (for authorization)
            
        Returns:
            Result dictionary
        """
        logger.info(f"Cancelling transfer {transfer_id} by {sender_twitter_user_id}")
        
        try:
            # Get the transfer
            result = await session.execute(
                select(PendingTransfer).where(
                    and_(
                        PendingTransfer.id == transfer_id,
                        PendingTransfer.sender_twitter_user_id == sender_twitter_user_id,
                        PendingTransfer.status == "pending"
                    )
                )
            )
            
            transfer = result.scalar_one_or_none()
            if not transfer:
                return {"success": False, "error": "Transfer not found or not authorized"}
            
            # Get sender to refund
            sender_result = await session.execute(
                select(User).where(User.twitter_user_id == sender_twitter_user_id)
            )
            sender = sender_result.scalar_one_or_none()
            
            if not sender:
                return {"success": False, "error": "Sender not found"}
            
            # Refund the sender using direct SQL
            await self._add_balance(session, sender.twitter_user_id, transfer.token_symbol, transfer.amount)
            
            # Mark transfer as cancelled
            transfer.status = "cancelled"
            transfer.cancelled_at = datetime.now(timezone.utc)
            
            await session.commit()
            
            logger.info(f"Transfer cancelled and {transfer.amount} {transfer.token_symbol} refunded")
            
            return {
                "success": True,
                "refunded_amount": transfer.amount,
                "token_symbol": transfer.token_symbol
            }
        
        except Exception as e:
            logger.error(f"Error cancelling transfer: {e}")
            await session.rollback()
            return {"success": False, "error": str(e)}