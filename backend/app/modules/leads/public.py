"""
Leads — public interface.

Per the master spec, "modules must communicate only through shared
services or public interfaces." This file is that interface for Leads.
Any other module (starting with Clients, in this phase) that needs
something from Leads imports *only* from here — never from
leads.models or leads.service directly. Leads has no idea Clients
exists; the dependency only ever points one way.

If Leads is ever disabled, every other module's imports from this file
simply return None / empty — nothing else breaks.
"""
import uuid
from typing import Optional

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.leads.models import Lead


class LeadSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    branch_id: Optional[uuid.UUID]
    is_converted: bool

    class Config:
        from_attributes = True


async def get_convertible_lead(db: AsyncSession, lead_id: uuid.UUID) -> Optional[LeadSummary]:
    """Returns the lead's public summary only if it has actually reached
    the 'converted' pipeline stage — enforces the business rule that a
    Client record may only be created from a lead that earned it, without
    Clients needing to know how the Lead pipeline works."""
    lead = await db.get(Lead, lead_id)
    if not lead or lead.deleted_at is not None or not lead.is_converted:
        return None
    return LeadSummary.model_validate(lead)


async def get_lead_counts_by_branch(db: AsyncSession) -> dict:
    """Counts only — no lead details. Used by Reports & Analytics
    (Phase 13) for branch performance views."""
    from sqlalchemy import func, select

    result = await db.execute(
        select(Lead.branch_id, func.count()).where(Lead.deleted_at.is_(None)).group_by(Lead.branch_id)
    )
    return {str(branch_id) if branch_id else "unassigned": count for branch_id, count in result.all()}
