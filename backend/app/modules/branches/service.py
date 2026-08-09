import uuid
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.branches.models import Branch
from app.modules.branches.schemas import BranchCreate, BranchUpdate


class BranchNotFoundError(Exception):
    pass


class BranchService:
    """All branch business logic lives here — routes stay thin."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_branches(self, include_inactive: bool = False) -> List[Branch]:
        stmt = select(Branch)
        if not include_inactive:
            stmt = stmt.where(Branch.is_active.is_(True))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_branch(self, branch_id: uuid.UUID) -> Optional[Branch]:
        return await self.db.get(Branch, branch_id)

    async def create_branch(self, data: BranchCreate) -> Branch:
        branch = Branch(**data.model_dump())
        self.db.add(branch)
        await self.db.commit()
        await self.db.refresh(branch)
        return branch

    async def update_branch(self, branch_id: uuid.UUID, data: BranchUpdate) -> Optional[Branch]:
        branch = await self.get_branch(branch_id)
        if not branch:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(branch, field, value)
        await self.db.commit()
        await self.db.refresh(branch)
        return branch

    async def reassign_all(self, from_branch_id: uuid.UUID, to_branch_id: uuid.UUID) -> dict:
        """Bulk-moves every user, lead, client, and case pointed at
        `from_branch_id` over to `to_branch_id` in one pass — the thing
        you actually need before a branch can safely be retired, since
        leaving records pointed at a deactivated branch silently strands
        them out of every branch-scoped view. Local imports of other
        modules' models are deliberate here (same pattern as
        permissions/service.py's role-deletion check) — this is the one
        place branches legitimately needs to reach into other modules'
        tables, and importing at call time avoids a load-order cycle
        rather than hiding a real circular dependency.
        """
        if not await self.get_branch(to_branch_id):
            raise BranchNotFoundError()

        from app.modules.users.models import User
        from app.modules.leads.models import Lead
        from app.modules.clients.models import Client
        from app.modules.cases.models import Case

        counts = {}
        for model, key in [(User, "users"), (Lead, "leads"), (Client, "clients"), (Case, "cases")]:
            result = await self.db.execute(
                update(model).where(model.branch_id == from_branch_id).values(branch_id=to_branch_id)
            )
            counts[key] = result.rowcount or 0

        await self.db.commit()
        return counts
