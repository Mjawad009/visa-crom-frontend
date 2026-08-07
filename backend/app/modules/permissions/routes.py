import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.permissions.schemas import PermissionRead, RoleCreate, RolePermissionsUpdate, RoleRead
from app.modules.permissions.service import (
    PermissionEngineService,
    RoleInUseError,
    RoleKeyAlreadyExistsError,
    RoleNotFoundError,
    SystemRoleError,
)

router = APIRouter()


@router.get("/roles", response_model=List[RoleRead])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("roles.manage")),
):
    return await PermissionEngineService(db).list_roles()


@router.post("/roles", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("roles.manage")),
):
    try:
        return await PermissionEngineService(db).create_role(
            payload.key, payload.name, payload.description, actor_user_id=current_user.id
        )
    except RoleKeyAlreadyExistsError:
        raise HTTPException(status.HTTP_409_CONFLICT, "A role with this key already exists")


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("roles.manage")),
):
    try:
        await PermissionEngineService(db).delete_role(role_id, actor_user_id=current_user.id)
    except RoleNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    except SystemRoleError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "System roles can't be deleted")
    except RoleInUseError:
        raise HTTPException(status.HTTP_409_CONFLICT, "This role is still assigned to at least one user")


@router.get("/permissions", response_model=List[PermissionRead])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("roles.manage")),
):
    return await PermissionEngineService(db).list_permissions()


@router.get("/roles/{role_id}/permissions", response_model=List[str])
async def get_role_permissions(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("roles.manage")),
):
    return await PermissionEngineService(db).get_role_permissions(role_id)


@router.put("/roles/{role_id}/permissions", response_model=List[str])
async def set_role_permissions(
    role_id: uuid.UUID,
    payload: RolePermissionsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("roles.manage")),
):
    try:
        return await PermissionEngineService(db).set_role_permissions(
            role_id, payload.permission_keys, actor_user_id=current_user.id
        )
    except RoleNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
