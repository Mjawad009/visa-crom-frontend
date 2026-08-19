"""Cases - public interface. Same pattern as leads/public.py and
clients/public.py. AI Platform (Phase 12) is the first caller."""
import uuid
from typing import Optional

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cases.models import Case


class CaseSummary(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    case_type: str
    destination_country: Optional[str]
    visa_type: Optional[str]
    assigned_consultant_id: Optional[uuid.UUID]
    branch_id: Optional[uuid.UUID]

    class Config:
        from_attributes = True


async def get_case_summary(db: AsyncSession, case_id: uuid.UUID) -> Optional[CaseSummary]:
    case = await db.get(Case, case_id)
    if not case or case.deleted_at is not None:
        return None
    return CaseSummary(
        id=case.id, client_id=case.client_id, case_type=case.case_type,
        destination_country=case.destination_country, visa_type=case.visa_type,
        assigned_consultant_id=case.assigned_consultant_id, branch_id=case.branch_id,
    )


async def get_case_counts_by_branch(db: AsyncSession) -> dict:
    """Counts only, for Reports & Analytics (Phase 13)."""
    from sqlalchemy import func, select

    result = await db.execute(
        select(Case.branch_id, func.count())
        .where(Case.deleted_at.is_(None), Case.is_closed.is_(False))
        .group_by(Case.branch_id)
    )
    return {str(branch_id) if branch_id else "unassigned": count for branch_id, count in result.all()}


async def get_case_counts_by_consultant(db: AsyncSession) -> dict:
    """Counts only, keyed by consultant user id, for staff workload views."""
    from sqlalchemy import func, select

    result = await db.execute(
        select(Case.assigned_consultant_id, func.count())
        .where(Case.deleted_at.is_(None), Case.is_closed.is_(False))
        .group_by(Case.assigned_consultant_id)
    )
    return {str(consultant_id) if consultant_id else "unassigned": count for consultant_id, count in result.all()}


async def get_case_summaries_for_client(db: AsyncSession, client_id: uuid.UUID) -> list[CaseSummary]:
    """All of one client's cases, summary-only — used by the read-only
    client API (Phase 14) so a client can see their own case list."""
    from sqlalchemy import select

    result = await db.execute(
        select(Case).where(Case.client_id == client_id, Case.deleted_at.is_(None)).order_by(Case.created_at.desc())
    )
    return [
        CaseSummary(
            id=c.id, client_id=c.client_id, case_type=c.case_type, destination_country=c.destination_country,
            visa_type=c.visa_type, assigned_consultant_id=c.assigned_consultant_id, branch_id=c.branch_id,
        )
        for c in result.scalars().all()
    ]
