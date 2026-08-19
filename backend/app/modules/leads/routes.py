import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.leads.schemas import LeadCreate, LeadRead, LeadTransitionRequest, LeadUpdate
from app.modules.leads.service import LeadNotFoundError, LeadService
from app.modules.workflow.service import InvalidTransitionError, WorkflowError

router = APIRouter()


@router.get("/", response_model=list[LeadRead])
async def list_leads(
    branch_id: Optional[uuid.UUID] = None,
    assigned_to_user_id: Optional[uuid.UUID] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if "leads.view" not in current_user.permissions and not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing required permission: leads.view")

    # Without leads.view_all, a user only ever sees their own assigned leads
    # — this is the ownership-scoping pattern every future module reuses.
    restrict_to = None
    if "leads.view_all" not in current_user.permissions and not current_user.is_superuser:
        restrict_to = current_user.id

    limit = min(limit, 200)
    return await LeadService(db).list_leads(
        branch_id=branch_id, assigned_to_user_id=assigned_to_user_id, restrict_to_user_id=restrict_to,
        limit=limit, offset=offset,
    )


@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    lead = await LeadService(db).get_lead_read(lead_id)
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")

    can_view_all = "leads.view_all" in current_user.permissions or current_user.is_superuser
    if not can_view_all and lead.assigned_to_user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this lead")

    return lead


@router.post("/", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("leads.create")),
):
    return await LeadService(db).create_lead(payload, actor_user_id=current_user.id)


@router.patch("/{lead_id}", response_model=LeadRead)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("leads.update")),
):
    lead = await LeadService(db).update_lead(lead_id, payload, actor_user_id=current_user.id)
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    return lead


@router.post("/{lead_id}/transition", response_model=LeadRead)
async def transition_lead(
    lead_id: uuid.UUID,
    payload: LeadTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("leads.update")),
):
    if payload.transition_key == "convert" and "leads.convert" not in current_user.permissions and not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing required permission: leads.convert")

    try:
        return await LeadService(db).transition(
            lead_id, payload.transition_key, actor_user_id=current_user.id, note=payload.note
        )
    except InvalidTransitionError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except (LeadNotFoundError, WorkflowError) as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc) or "Lead not found")
