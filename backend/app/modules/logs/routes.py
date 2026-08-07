import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.logs.schemas import ActivityLogRead, AuditLogRead
from app.modules.logs.service import LogsQueryService

router = APIRouter()


@router.get("/activity", response_model=List[ActivityLogRead])
async def get_activity_logs(
    branch_id: Optional[uuid.UUID] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("logs.view_activity")),
):
    return await LogsQueryService(db).list_activity(branch_id, entity_type, entity_id, limit)


@router.get("/audit", response_model=List[AuditLogRead])
async def get_audit_logs(
    branch_id: Optional[uuid.UUID] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("logs.view_audit")),
):
    return await LogsQueryService(db).list_audit(branch_id, entity_type, entity_id, limit)
