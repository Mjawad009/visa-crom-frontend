import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.logs.models import ActivityLog, AuditLog


class LogsQueryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_activity(
        self,
        branch_id: Optional[uuid.UUID] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[ActivityLog]:
        stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)
        if branch_id:
            stmt = stmt.where(ActivityLog.branch_id == branch_id)
        if entity_type:
            stmt = stmt.where(ActivityLog.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(ActivityLog.entity_id == entity_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_audit(
        self,
        branch_id: Optional[uuid.UUID] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[AuditLog]:
        stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        if branch_id:
            stmt = stmt.where(AuditLog.branch_id == branch_id)
        if entity_type:
            stmt = stmt.where(AuditLog.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(AuditLog.entity_id == entity_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
