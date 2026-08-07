"""Admissions - public interface. Same pattern as the others."""
import uuid
from typing import Optional

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admissions.models import AdmissionApplication


class AdmissionSummary(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    institution_name: str
    program_name: Optional[str]
    country: Optional[str]
    intake_term: Optional[str]
    assigned_officer_id: Optional[uuid.UUID]

    class Config:
        from_attributes = True


async def get_admission_summary(db: AsyncSession, admission_id: uuid.UUID) -> Optional[AdmissionSummary]:
    app = await db.get(AdmissionApplication, admission_id)
    if not app or app.deleted_at is not None:
        return None
    return AdmissionSummary(
        id=app.id, client_id=app.client_id, institution_name=app.institution_name,
        program_name=app.program_name, country=app.country, intake_term=app.intake_term,
        assigned_officer_id=app.assigned_officer_id,
    )


async def get_admission_counts_by_branch(db: AsyncSession) -> dict:
    """Counts only, for Reports & Analytics (Phase 13)."""
    from sqlalchemy import func, select

    result = await db.execute(
        select(AdmissionApplication.branch_id, func.count())
        .where(AdmissionApplication.deleted_at.is_(None), AdmissionApplication.is_closed.is_(False))
        .group_by(AdmissionApplication.branch_id)
    )
    return {str(branch_id) if branch_id else "unassigned": count for branch_id, count in result.all()}


async def get_admission_summaries_for_client(db: AsyncSession, client_id: uuid.UUID) -> list[AdmissionSummary]:
    """All of one client's admission applications, summary-only — used
    by the read-only client API (Phase 14)."""
    from sqlalchemy import select

    result = await db.execute(
        select(AdmissionApplication)
        .where(AdmissionApplication.client_id == client_id, AdmissionApplication.deleted_at.is_(None))
        .order_by(AdmissionApplication.created_at.desc())
    )
    return [
        AdmissionSummary(
            id=a.id, client_id=a.client_id, institution_name=a.institution_name, program_name=a.program_name,
            country=a.country, intake_term=a.intake_term, assigned_officer_id=a.assigned_officer_id,
        )
        for a in result.scalars().all()
    ]
