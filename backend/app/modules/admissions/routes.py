import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.modules.admissions.schemas import (
    AdmissionApplicationCreate,
    AdmissionApplicationRead,
    AdmissionApplicationUpdate,
    AdmissionTransitionRequest,
)
from app.modules.admissions.service import AdmissionNotFoundError, AdmissionService, ClientNotEligibleError
from app.modules.auth.schemas import CurrentUser
from app.modules.workflow.service import InvalidTransitionError, WorkflowError

router = APIRouter()


@router.get("/", response_model=list[AdmissionApplicationRead])
async def list_applications(
    client_id: Optional[uuid.UUID] = None,
    branch_id: Optional[uuid.UUID] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if "admissions.view" not in current_user.permissions and not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing required permission: admissions.view")

    restrict_to = None
    if "admissions.view_all" not in current_user.permissions and not current_user.is_superuser:
        restrict_to = current_user.id

    limit = min(limit, 200)
    return await AdmissionService(db).list_applications(
        client_id=client_id, branch_id=branch_id, restrict_to_officer_id=restrict_to, limit=limit, offset=offset
    )


@router.get("/{app_id}", response_model=AdmissionApplicationRead)
async def get_application(
    app_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    app = await AdmissionService(db).get_application_read(app_id)
    if not app:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")

    can_view_all = "admissions.view_all" in current_user.permissions or current_user.is_superuser
    if not can_view_all and app.assigned_officer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this application")

    return app


@router.post("/", response_model=AdmissionApplicationRead, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: AdmissionApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("admissions.create")),
):
    try:
        return await AdmissionService(db).create_application(payload, actor_user_id=current_user.id)
    except ClientNotEligibleError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This client does not exist or is not active")


@router.patch("/{app_id}", response_model=AdmissionApplicationRead)
async def update_application(
    app_id: uuid.UUID,
    payload: AdmissionApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("admissions.update")),
):
    app = await AdmissionService(db).update_application(app_id, payload, actor_user_id=current_user.id)
    if not app:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    return app


@router.post("/{app_id}/transition", response_model=AdmissionApplicationRead)
async def transition_application(
    app_id: uuid.UUID,
    payload: AdmissionTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("admissions.update")),
):
    try:
        return await AdmissionService(db).transition(app_id, payload.transition_key, actor_user_id=current_user.id, note=payload.note)
    except InvalidTransitionError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except (AdmissionNotFoundError, WorkflowError) as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc) or "Application not found")
