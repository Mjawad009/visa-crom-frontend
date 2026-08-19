import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.cases.schemas import CaseCreate, CaseRead, CaseTransitionRequest, CaseUpdate
from app.modules.cases.service import CaseNotFoundError, CaseService, ClientNotEligibleError
from app.modules.workflow.service import InvalidTransitionError, WorkflowError

router = APIRouter()


@router.get("/", response_model=list[CaseRead])
async def list_cases(
    client_id: Optional[uuid.UUID] = None,
    branch_id: Optional[uuid.UUID] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if "cases.view" not in current_user.permissions and not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing required permission: cases.view")

    restrict_to = None
    if "cases.view_all" not in current_user.permissions and not current_user.is_superuser:
        restrict_to = current_user.id

    limit = min(limit, 200)  # hard cap regardless of what the caller asks for
    return await CaseService(db).list_cases(
        client_id=client_id, branch_id=branch_id, restrict_to_consultant_id=restrict_to, limit=limit, offset=offset
    )


@router.get("/{case_id}", response_model=CaseRead)
async def get_case(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    case = await CaseService(db).get_case_read(case_id)
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")

    can_view_all = "cases.view_all" in current_user.permissions or current_user.is_superuser
    if not can_view_all and case.assigned_consultant_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this case")

    return case


@router.post("/", response_model=CaseRead, status_code=status.HTTP_201_CREATED)
async def create_case(
    payload: CaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("cases.create")),
):
    try:
        return await CaseService(db).create_case(payload, actor_user_id=current_user.id)
    except ClientNotEligibleError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This client does not exist or is not active")


@router.patch("/{case_id}", response_model=CaseRead)
async def update_case(
    case_id: uuid.UUID,
    payload: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("cases.update")),
):
    case = await CaseService(db).update_case(case_id, payload, actor_user_id=current_user.id)
    if not case:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    return case


@router.post("/{case_id}/transition", response_model=CaseRead)
async def transition_case(
    case_id: uuid.UUID,
    payload: CaseTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("cases.update")),
):
    try:
        return await CaseService(db).transition(case_id, payload.transition_key, actor_user_id=current_user.id, note=payload.note)
    except InvalidTransitionError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except (CaseNotFoundError, WorkflowError) as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc) or "Case not found")
