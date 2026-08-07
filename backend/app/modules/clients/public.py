"""
Clients — public interface. Same pattern as app/modules/leads/public.py:
this is the only thing another module may import from Clients.
"""
import uuid
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.clients.models import Client


class ClientSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    branch_id: Optional[uuid.UUID]
    assigned_consultant_id: Optional[uuid.UUID]
    is_active: bool

    class Config:
        from_attributes = True


async def get_active_client(db: AsyncSession, client_id: uuid.UUID) -> Optional[ClientSummary]:
    """Returns the client's public summary only if the record exists and
    is active — enforces "a case can only be opened for an active client"
    without Cases needing to know anything about Clients' internals."""
    client = await db.get(Client, client_id)
    if not client or client.deleted_at is not None or not client.is_active:
        return None
    return ClientSummary.model_validate(client)


async def get_client_display_name(db: AsyncSession, client_id: uuid.UUID) -> Optional[str]:
    """Looser than get_active_client — used purely for display (e.g.
    showing a client's name on a case card), so it doesn't enforce the
    'must be active' rule. Never use this result to authorize an action."""
    client = await db.get(Client, client_id)
    if not client or client.deleted_at is not None:
        return None
    return client.full_name


async def get_client_display_names(db: AsyncSession, client_ids: list[uuid.UUID]) -> dict:
    """Batch version of get_client_display_name — fixes the N+1 in
    Cases/Admissions list methods, which were calling the single lookup
    once per row. One query regardless of list size."""
    if not client_ids:
        return {}
    result = await db.execute(select(Client.id, Client.full_name).where(Client.id.in_(client_ids)))
    return {client_id: name for client_id, name in result.all()}


class ClientAIContext(BaseModel):
    """Fields worth handing to an AI prompt (SOP/summary generation) —
    deliberately excludes passport number and other sensitive identifiers
    that a generated document/summary doesn't need."""

    id: uuid.UUID
    full_name: str
    nationality: Optional[str]
    assigned_consultant_id: Optional[uuid.UUID]
    branch_id: Optional[uuid.UUID]

    class Config:
        from_attributes = True


async def get_client_ai_context(db: AsyncSession, client_id: uuid.UUID) -> Optional[ClientAIContext]:
    client = await db.get(Client, client_id)
    if not client or client.deleted_at is not None:
        return None
    return ClientAIContext(
        id=client.id, full_name=client.full_name, nationality=client.nationality,
        assigned_consultant_id=client.assigned_consultant_id, branch_id=client.branch_id,
    )


async def get_client_counts_by_branch(db: AsyncSession) -> dict:
    """Counts only, for Reports & Analytics (Phase 13)."""
    from sqlalchemy import func, select

    result = await db.execute(
        select(Client.branch_id, func.count())
        .where(Client.deleted_at.is_(None), Client.is_active.is_(True))
        .group_by(Client.branch_id)
    )
    return {str(branch_id) if branch_id else "unassigned": count for branch_id, count in result.all()}


class ClientOwnProfile(BaseModel):
    """Full self-view of a client's own record — unlike every other
    public.py function here, this deliberately includes passport details,
    because the one consumer of this function is the client themself
    (via the read-only /me API, Phase 14), not another staff-facing
    module. Never return this in response to any other caller."""

    id: uuid.UUID
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    nationality: Optional[str]
    passport_number: Optional[str]
    passport_expiry: Optional[str]

    class Config:
        from_attributes = True


async def get_client_id_for_user(db: AsyncSession, user_id: uuid.UUID) -> Optional[uuid.UUID]:
    """The one lookup the read-only client API needs to go from
    'authenticated user' to 'which client record is this'."""
    from sqlalchemy import select

    result = await db.execute(select(Client.id).where(Client.user_id == user_id, Client.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_own_profile(db: AsyncSession, client_id: uuid.UUID) -> Optional["ClientOwnProfile"]:
    client = await db.get(Client, client_id)
    if not client or client.deleted_at is not None:
        return None
    return ClientOwnProfile(
        id=client.id, full_name=client.full_name, email=client.email, phone=client.phone,
        nationality=client.nationality, passport_number=client.passport_number,
        passport_expiry=client.passport_expiry.isoformat() if client.passport_expiry else None,
    )
