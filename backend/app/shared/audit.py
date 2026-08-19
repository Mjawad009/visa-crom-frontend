import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.logs.models import AuditLog


async def log_audit(
    db: AsyncSession,
    *,
    actor_user_id: Optional[uuid.UUID],
    branch_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: str,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Record a before/after snapshot for a sensitive change. Use for:
    permission changes, financial record edits, document deletion,
    user deactivation, and anything else compliance may need to
    reconstruct later. Does not commit — same convention as log_activity."""
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            branch_id=branch_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before_json=before,
            after_json=after,
            ip_address=ip_address,
        )
    )
