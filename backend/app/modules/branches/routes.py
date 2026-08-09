import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.branches.schemas import BranchCreate, BranchRead, BranchUpdate
from app.modules.branches.service import BranchNotFoundError, BranchService

router = APIRouter()


@router.get("/", response_model=list[BranchRead])
async def list_branches(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("branches.view")),
):
    return await BranchService(db).list_branches(include_inactive=include_inactive)


@router.post("/", response_model=BranchRead, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: BranchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("branches.manage")),
):
    return await BranchService(db).create_branch(payload)


@router.patch("/{branch_id}", response_model=BranchRead)
async def update_branch(
    branch_id: uuid.UUID,
    payload: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("branches.manage")),
):
    branch = await BranchService(db).update_branch(branch_id, payload)
    if not branch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Branch not found")
    return branch


@router.post("/{branch_id}/reassign-all")
async def reassign_all(
    branch_id: uuid.UUID,
    to_branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("branches.manage")),
):
    """Moves every user/lead/client/case pointed at `branch_id` over to
    `to_branch_id`. Meant to be run right before deactivating a branch
    so nothing gets orphaned — the frontend calls this from the
    deactivate confirmation dialog when there's another active branch
    to receive everything."""
    try:
        counts = await BranchService(db).reassign_all(branch_id, to_branch_id)
    except BranchNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Destination branch not found")
    return {"reassigned": counts}
