import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.clients.models import Client
from app.modules.clients.schemas import ClientCreate, ClientUpdate
from app.modules.leads.public import get_convertible_lead
from app.shared.activity import log_activity
from app.shared.audit import log_audit


class LeadNotConvertibleError(Exception):
    """Raised when a client is being created from a lead_id that either
    doesn't exist or hasn't reached the 'converted' stage yet."""


class ClientService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_clients(
        self,
        *,
        branch_id: Optional[uuid.UUID] = None,
        restrict_to_consultant_id: Optional[uuid.UUID] = None,
        include_inactive: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Client]:
        stmt = select(Client).where(Client.deleted_at.is_(None)).order_by(Client.created_at.desc())
        if not include_inactive:
            stmt = stmt.where(Client.is_active.is_(True))
        if branch_id:
            stmt = stmt.where(Client.branch_id == branch_id)
        if restrict_to_consultant_id:
            stmt = stmt.where(Client.assigned_consultant_id == restrict_to_consultant_id)
        stmt = stmt.limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_client(self, client_id: uuid.UUID) -> Optional[Client]:
        client = await self.db.get(Client, client_id)
        if not client or client.deleted_at is not None:
            return None
        return client

    async def create_client(self, data: ClientCreate, actor_user_id: uuid.UUID) -> Client:
        if data.lead_id is not None:
            lead = await get_convertible_lead(self.db, data.lead_id)
            if not lead:
                raise LeadNotConvertibleError()

        client = Client(**data.model_dump())
        self.db.add(client)
        await self.db.flush()

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=client.branch_id, module="clients",
            action="created", entity_type="client", entity_id=str(client.id),
            metadata={"from_lead": str(data.lead_id) if data.lead_id else None},
        )
        await self.db.commit()
        await self.db.refresh(client)
        return client

    async def update_client(self, client_id: uuid.UUID, data: ClientUpdate, actor_user_id: uuid.UUID) -> Optional[Client]:
        client = await self.get_client(client_id)
        if not client:
            return None

        deactivating = data.is_active is False and client.is_active is True
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(client, field, value)

        if deactivating:
            await log_audit(
                self.db, actor_user_id=actor_user_id, branch_id=client.branch_id,
                action="client_deactivated", entity_type="client", entity_id=str(client.id),
                before={"is_active": True}, after={"is_active": False},
            )
        else:
            await log_activity(
                self.db, actor_user_id=actor_user_id, branch_id=client.branch_id, module="clients",
                action="updated", entity_type="client", entity_id=str(client.id),
            )
        await self.db.commit()
        await self.db.refresh(client)
        return client
