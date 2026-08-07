import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.workflow.schemas import (
    StartWorkflowRequest,
    TransitionRequest,
    WorkflowDefinitionCreate,
    WorkflowDefinitionRead,
    WorkflowInstanceRead,
)
from app.modules.workflow.service import InvalidTransitionError, WorkflowEngineService, WorkflowError

router = APIRouter()


@router.get("/definitions", response_model=list[WorkflowDefinitionRead])
async def list_definitions(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("workflow.manage_definitions")),
):
    return await WorkflowEngineService(db).list_definitions()


@router.post("/definitions", response_model=WorkflowDefinitionRead, status_code=status.HTTP_201_CREATED)
async def create_definition(
    payload: WorkflowDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("workflow.manage_definitions")),
):
    return await WorkflowEngineService(db).create_definition(payload)


@router.post("/instances", response_model=WorkflowInstanceRead, status_code=status.HTTP_201_CREATED)
async def start_instance(
    payload: StartWorkflowRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("workflow.transition")),
):
    try:
        return await WorkflowEngineService(db).start_instance(
            payload.definition_key, payload.entity_type, payload.entity_id,
            payload.branch_id, actor_user_id=current_user.id,
        )
    except WorkflowError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


@router.post("/instances/{instance_id}/transition", response_model=WorkflowInstanceRead)
async def transition_instance(
    instance_id: uuid.UUID,
    payload: TransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("workflow.transition")),
):
    try:
        return await WorkflowEngineService(db).apply_transition(
            instance_id, payload.transition_key, actor_user_id=current_user.id, note=payload.note
        )
    except InvalidTransitionError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except WorkflowError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
