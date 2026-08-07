import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.users.schemas import PasswordResetRequest, UserCreate, UserRead, UserUpdate
from app.modules.users.service import EmailAlreadyExistsError, UserService

router = APIRouter()


@router.get("/", response_model=List[UserRead])
async def list_users(
    branch_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("users.view")),
):
    return await UserService(db).list_users(branch_id=branch_id)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("users.view")),
):
    user = await UserService(db).get_user(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("users.create")),
):
    try:
        return await UserService(db).create_user(payload, actor_user_id=current_user.id)
    except EmailAlreadyExistsError:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("users.update")),
):
    try:
        user = await UserService(db).update_user(user_id, payload, actor_user_id=current_user.id)
    except EmailAlreadyExistsError:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.post("/{user_id}/reset-password", response_model=UserRead)
async def reset_password(
    user_id: uuid.UUID,
    payload: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("users.update")),
):
    """Admin-initiated password reset — sets a new password directly.
    Distinct from a self-service 'forgot password' email flow (not built
    yet); this is the "I need to hand someone new credentials right
    now" path a manager uses from the Users page."""
    if len(payload.new_password) < 8:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Password must be at least 8 characters")
    user = await UserService(db).reset_password(user_id, payload.new_password, actor_user_id=current_user.id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user
