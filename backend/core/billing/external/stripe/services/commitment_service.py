from typing import Dict

from core.utils.logger import logger
from ..repositories.commitment_repository import CommitmentRepository

class CommitmentService:
    def __init__(self):
        self.commitment_repo = CommitmentRepository()
    
    async def track_commitment_if_needed(
        self, 
        account_id: str, 
        price_id: str, 
        subscription: Dict,
        commitment_type: str = None
    ) -> None:
        """Yearly-commitment Stripe products were removed; legacy rows may still exist in DB."""
        return
    
    async def clear_commitment_if_needed(self, account_id: str) -> None:
        await self.commitment_repo.update_commitment_in_credit_account(account_id, {
            'commitment_type': None,
            'commitment_start_date': None,
            'commitment_end_date': None,
            'commitment_price_id': None,
            'can_cancel_after': None
        })
        
        logger.info(f"[COMMITMENT] Cleared commitment fields for {account_id}")
    
    def is_scheduled_downgrade_ready(
        self, 
        scheduled_changes: Dict, 
        current_price_id: str
    ) -> bool:
        if not scheduled_changes:
            return False
            
        scheduled_price_id = scheduled_changes.get('scheduled_price_id')
        return scheduled_price_id and current_price_id == scheduled_price_id
