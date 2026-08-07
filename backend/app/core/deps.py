"""
Shared FastAPI dependencies.

`get_current_user` and `require_permission` are used by every module's
routes. They live in core (not inside the auth or permissions modules)
because they are infrastructure, not business logic — this is the one
deliberate exception to "modules never import each other", and it only
flows one way: core is allowed to know about User/Role/Permission
models to resolve identity; business modules never import each other.
"""
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_token
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.permissions.models import Permission, RolePermission, Role
from app.modules.users.models import User
from app.shared.cache import cache_get, cache_set

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

PERMISSIONS_CACHE_TTL_SECONDS = 300  # role grants change rarely; 5 min is a safe staleness window


async def _get_role_permissions(db: AsyncSession, role_id) -> list[str]:
    """The one thing this file caches: which permission keys a role has.
    Everything else (user active status, role assignment) is read live
    on every request, so deactivating a user or changing their role
    still takes effect immediately — only the *contents* of a role's
    permission set are cached, and that cache is explicitly invalidated
    whenever app/modules/permissions/service.py changes a role's grants."""
    cache_key = f"role_permissions:{role_id}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    perm_rows = await db.execute(
        select(Permission.key)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role_id)
    )
    permissions = [row[0] for row in perm_rows.all()]
    # Deliberately skip caching an empty result. Every system role has
    # at least one grant, so an empty list here almost always means
    # "seed_permissions() hasn't finished yet" (it runs as a
    # fire-and-forget background task on startup — see main.py) rather
    # than a role that legitimately has zero permissions. Caching that
    # empty snapshot for the full TTL used to make even the CEO look
    # permission-less for up to 5 minutes after any fresh deploy/restart.
    if permissions:
        await cache_set(cache_key, permissions, ttl_seconds=PERMISSIONS_CACHE_TTL_SECONDS)
    return permissions


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    user_id = payload.get("sub")
    user = await db.scalar(
        select(User).where(User.id == user_id).options(selectinload(User.additional_roles))
    )
    if not user or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    role = await db.get(Role, user.role_id)

    # A user's effective permissions are the union of their primary
    # role's grants plus every additional role they've been assigned
    # (see users/models.py UserRole) — one person can be both a
    # Consultant and cover Reception duties, for example.
    role_ids = {user.role_id, *user.additional_role_ids}
    permissions: set[str] = set()
    for rid in role_ids:
        permissions.update(await _get_role_permissions(db, rid))

    return CurrentUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role_key=role.key,
        branch_id=user.branch_id,
        is_superuser=user.is_superuser,
        permissions=sorted(permissions),
    )


def require_permission(permission_key: str) -> Callable:
    """Route-level guard: `Depends(require_permission("users.create"))`.
    Superusers (CEO break-glass) always pass."""

    async def _checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.is_superuser:
            return current_user
        if permission_key not in current_user.permissions:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Missing required permission: {permission_key}",
            )
        return current_user

    return _checker
