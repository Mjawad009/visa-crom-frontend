import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.modules.users.models import User, UserRole
from app.modules.users.schemas import UserCreate, UserUpdate
from app.shared.activity import log_activity
from app.shared.audit import log_audit


class EmailAlreadyExistsError(Exception):
    pass


def _with_roles(stmt):
    return stmt.options(selectinload(User.additional_roles))


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_users(self, branch_id: Optional[uuid.UUID] = None) -> List[User]:
        stmt = _with_roles(select(User).where(User.deleted_at.is_(None)))
        if branch_id:
            stmt = stmt.where(User.branch_id == branch_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_user(self, user_id: uuid.UUID) -> Optional[User]:
        stmt = _with_roles(select(User).where(User.id == user_id))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _email_taken(self, email: str, exclude_user_id: Optional[uuid.UUID] = None) -> bool:
        stmt = select(User.id).where(User.email == email)
        if exclude_user_id:
            stmt = stmt.where(User.id != exclude_user_id)
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def create_user(self, data: UserCreate, actor_user_id: uuid.UUID) -> User:
        if await self._email_taken(data.email):
            raise EmailAlreadyExistsError()

        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            phone=data.phone,
            role_id=data.role_id,
            branch_id=data.branch_id,
        )
        self.db.add(user)
        await self.db.flush()  # get user.id before logging / linking roles

        for role_id in set(data.additional_role_ids):
            self.db.add(UserRole(user_id=user.id, role_id=role_id))

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=user.branch_id,
            module="users", action="created", entity_type="user", entity_id=str(user.id),
        )
        await self.db.commit()
        return await self.get_user(user.id)  # re-fetch with additional_roles eagerly loaded

    async def update_user(self, user_id: uuid.UUID, data: UserUpdate, actor_user_id: uuid.UUID) -> Optional[User]:
        user = await self.get_user(user_id)
        if not user:
            return None

        changes = data.model_dump(exclude_unset=True)
        additional_role_ids = changes.pop("additional_role_ids", None)

        if "email" in changes and changes["email"] != user.email:
            if await self._email_taken(changes["email"], exclude_user_id=user_id):
                raise EmailAlreadyExistsError()

        before = {"role_id": str(user.role_id), "is_active": user.is_active, "branch_id": str(user.branch_id) if user.branch_id else None}
        for field, value in changes.items():
            setattr(user, field, value)
        after = {"role_id": str(user.role_id), "is_active": user.is_active, "branch_id": str(user.branch_id) if user.branch_id else None}

        if additional_role_ids is not None:
            # Full replace, same pattern as PermissionEngineService.set_role_permissions.
            await self.db.execute(
                UserRole.__table__.delete().where(UserRole.user_id == user_id)
            )
            for role_id in set(additional_role_ids):
                self.db.add(UserRole(user_id=user_id, role_id=role_id))

        # Role/active-status changes are security-relevant -> audit log, not just activity log.
        if before != after or additional_role_ids is not None:
            await log_audit(
                self.db, actor_user_id=actor_user_id, branch_id=user.branch_id,
                action="user_updated", entity_type="user", entity_id=str(user.id),
                before=before, after=after,
            )
        await self.db.commit()
        return await self.get_user(user_id)  # re-fetch with additional_roles eagerly loaded

    async def reset_password(self, user_id: uuid.UUID, new_password: str, actor_user_id: uuid.UUID) -> Optional[User]:
        user = await self.get_user(user_id)
        if not user:
            return None
        user.hashed_password = hash_password(new_password)
        await log_audit(
            self.db, actor_user_id=actor_user_id, branch_id=user.branch_id,
            action="user_password_reset", entity_type="user", entity_id=str(user.id),
            before=None, after=None,
        )
        await self.db.commit()
        return await self.get_user(user_id)
