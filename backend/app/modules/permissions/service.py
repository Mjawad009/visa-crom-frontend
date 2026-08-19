import uuid
from typing import List

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.permissions.models import Permission, Role, RolePermission
from app.shared.audit import log_audit
from app.shared.cache import cache_delete


class RoleNotFoundError(Exception):
    pass


class RoleKeyAlreadyExistsError(Exception):
    pass


class RoleInUseError(Exception):
    pass


class SystemRoleError(Exception):
    pass


class PermissionEngineService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_roles(self) -> List[Role]:
        result = await self.db.execute(select(Role))
        return list(result.scalars().all())

    async def create_role(self, key: str, name: str, description: str | None, actor_user_id: uuid.UUID) -> Role:
        existing = (await self.db.execute(select(Role).where(Role.key == key))).scalar_one_or_none()
        if existing:
            raise RoleKeyAlreadyExistsError()

        role = Role(key=key, name=name, description=description, is_system=False)
        self.db.add(role)
        await self.db.flush()

        await log_audit(
            self.db, actor_user_id=actor_user_id, branch_id=None,
            action="role_created", entity_type="role", entity_id=str(role.id),
            before=None, after={"key": key, "name": name},
        )
        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def delete_role(self, role_id: uuid.UUID, actor_user_id: uuid.UUID) -> None:
        role = await self.db.get(Role, role_id)
        if not role:
            raise RoleNotFoundError()
        if role.is_system:
            raise SystemRoleError()

        # Import kept local to avoid a permissions <-> users module
        # import cycle at module load time — same discipline as
        # core/deps.py's cross-module identity resolution.
        from app.modules.users.models import User, UserRole

        in_use_primary = (
            await self.db.execute(select(User.id).where(User.role_id == role_id, User.deleted_at.is_(None)).limit(1))
        ).scalar_one_or_none()
        in_use_additional = (
            await self.db.execute(select(UserRole.user_id).where(UserRole.role_id == role_id).limit(1))
        ).scalar_one_or_none()
        if in_use_primary or in_use_additional:
            raise RoleInUseError()

        await log_audit(
            self.db, actor_user_id=actor_user_id, branch_id=None,
            action="role_deleted", entity_type="role", entity_id=str(role_id),
            before={"key": role.key, "name": role.name}, after=None,
        )
        await self.db.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
        await self.db.delete(role)
        await self.db.commit()
        await cache_delete(f"role_permissions:{role_id}")

    async def list_permissions(self) -> List[Permission]:
        result = await self.db.execute(select(Permission))
        return list(result.scalars().all())

    async def get_role_permissions(self, role_id: uuid.UUID) -> List[str]:
        result = await self.db.execute(
            select(Permission.key)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
        )
        return [row[0] for row in result.all()]

    async def set_role_permissions(
        self, role_id: uuid.UUID, permission_keys: List[str], actor_user_id: uuid.UUID
    ) -> List[str]:
        role = await self.db.get(Role, role_id)
        if not role:
            raise RoleNotFoundError()

        before = await self.get_role_permissions(role_id)

        # Replace the full grant set atomically — simplest mental model for admins.
        await self.db.execute(delete(RolePermission).where(RolePermission.role_id == role_id))

        perms = (
            await self.db.execute(select(Permission).where(Permission.key.in_(permission_keys)))
        ).scalars().all()
        for perm in perms:
            self.db.add(RolePermission(role_id=role_id, permission_id=perm.id))

        await log_audit(
            self.db, actor_user_id=actor_user_id, branch_id=None,
            action="role_permissions_changed", entity_type="role", entity_id=str(role_id),
            before={"permissions": before}, after={"permissions": permission_keys},
        )
        await self.db.commit()
        # The whole reason this cache exists (see core/deps.py) is that
        # role grants change rarely — but when they do, staff expect it
        # to take effect immediately, not after a 5-minute TTL.
        await cache_delete(f"role_permissions:{role_id}")
        return await self.get_role_permissions(role_id)
