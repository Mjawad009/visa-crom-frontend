import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.tasks.schemas import TaskCreate, TaskRead, TaskUpdate
from app.modules.tasks.service import TaskService

router = APIRouter()


@router.get("/", response_model=list[TaskRead])
async def list_tasks(
    status_filter: Optional[str] = None,
    branch_id: Optional[uuid.UUID] = None,
    assigned_to_user_id: Optional[uuid.UUID] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    due_before: Optional[datetime] = None,
    due_after: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if "tasks.view" not in current_user.permissions and not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing required permission: tasks.view")

    # Same ownership-scoping pattern as Leads/Cases/Admissions: without
    # tasks.view_all, callers only ever see tasks assigned to them.
    restrict_to = None
    if "tasks.view_all" not in current_user.permissions and not current_user.is_superuser:
        restrict_to = current_user.id

    limit = min(limit, 200)
    return await TaskService(db).list_tasks(
        status=status_filter, branch_id=branch_id, assigned_to_user_id=assigned_to_user_id,
        entity_type=entity_type, entity_id=entity_id, due_before=due_before, due_after=due_after,
        restrict_to_user_id=restrict_to, limit=limit, offset=offset,
    )


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    task = await TaskService(db).get_task(task_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")

    can_view_all = "tasks.view_all" in current_user.permissions or current_user.is_superuser
    if not can_view_all and task.assigned_to_user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this task")

    return task


@router.post("/", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tasks.create")),
):
    return await TaskService(db).create_task(payload, actor_user_id=current_user.id)


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tasks.update")),
):
    task = await TaskService(db).update_task(task_id, payload, actor_user_id=current_user.id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.post("/{task_id}/complete", response_model=TaskRead)
async def complete_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tasks.update")),
):
    task = await TaskService(db).complete_task(task_id, actor_user_id=current_user.id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.post("/{task_id}/cancel", response_model=TaskRead)
async def cancel_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("tasks.update")),
):
    task = await TaskService(db).cancel_task(task_id, actor_user_id=current_user.id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.post("/dispatch-reminders", status_code=status.HTTP_200_OK)
async def dispatch_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Meant to be hit by a scheduled job (cron/Celery beat), not a
    person clicking a button — gated to superuser rather than a normal
    staff permission for that reason. Wire a scheduler to call this
    every few minutes once deployed; see app/shared/reminders.py for
    what actually happens per task."""
    if not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This endpoint is for scheduled jobs only")
    dispatched = await TaskService(db).dispatch_due_reminders()
    return {"dispatched": dispatched}
