import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.logs.models import ActivityLog


async def log_activity(
    db: AsyncSession,
    *,
    actor_user_id: Optional[uuid.UUID],
    branch_id: Optional[uuid.UUID],
    module: str,
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: Optional[dict] = None,
) -> None:
    """Write one activity feed entry. Does not commit its own transaction —
    callers typically do this inside the same commit as the business action
    it's describing, so the two never disagree."""
    db.add(
        ActivityLog(
            actor_user_id=actor_user_id,
            branch_id=branch_id,
            module=module,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata,
        )
    )
