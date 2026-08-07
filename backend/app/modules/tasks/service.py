import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tasks.models import Task
from app.modules.tasks.schemas import TaskCreate, TaskUpdate
from app.shared.activity import log_activity
from app.shared.reminders import dispatch_task_reminder


class TaskNotFoundError(Exception):
    pass


def _advance_due_date(due_at: datetime, recurrence: str) -> datetime:
    if recurrence == "daily":
        return due_at + timedelta(days=1)
    if recurrence == "weekly":
        return due_at + timedelta(weeks=1)
    if recurrence == "monthly":
        # Naive month-add (no calendar library dependency for this): if
        # the day overflows the next month's length (e.g. 31st -> Feb),
        # clamp to that month's last day rather than rolling into the
        # month after — matches how most calendar apps handle it.
        month = due_at.month + 1
        year = due_at.year + (1 if month > 12 else 0)
        month = 1 if month > 12 else month
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        day = min(due_at.day, last_day)
        return due_at.replace(year=year, month=month, day=day)
    return due_at


class TaskService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_tasks(
        self,
        *,
        status: Optional[str] = None,
        branch_id: Optional[uuid.UUID] = None,
        assigned_to_user_id: Optional[uuid.UUID] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        due_before: Optional[datetime] = None,
        due_after: Optional[datetime] = None,
        restrict_to_user_id: Optional[uuid.UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Task]:
        """`restrict_to_user_id` is set when the caller only has
        `tasks.view` (their own tasks), not `tasks.view_all` — same
        ownership-scoping pattern as every other module."""
        stmt = select(Task).where(Task.deleted_at.is_(None)).order_by(Task.due_at.asc())
        if status:
            stmt = stmt.where(Task.status == status)
        if branch_id:
            stmt = stmt.where(Task.branch_id == branch_id)
        if assigned_to_user_id:
            stmt = stmt.where(Task.assigned_to_user_id == assigned_to_user_id)
        if entity_type:
            stmt = stmt.where(Task.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(Task.entity_id == entity_id)
        if due_before:
            stmt = stmt.where(Task.due_at <= due_before)
        if due_after:
            stmt = stmt.where(Task.due_at >= due_after)
        if restrict_to_user_id:
            stmt = stmt.where(Task.assigned_to_user_id == restrict_to_user_id)
        stmt = stmt.limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_task(self, task_id: uuid.UUID) -> Optional[Task]:
        task = await self.db.get(Task, task_id)
        if not task or task.deleted_at is not None:
            return None
        return task

    async def create_task(self, data: TaskCreate, actor_user_id: uuid.UUID) -> Task:
        payload = data.model_dump()
        payload["assigned_to_user_id"] = payload.get("assigned_to_user_id") or actor_user_id
        task = Task(**payload, created_by_user_id=actor_user_id)
        self.db.add(task)
        await self.db.flush()

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=task.branch_id, module="tasks",
            action="created", entity_type="task", entity_id=str(task.id),
            metadata={"task_type": task.task_type, "due_at": task.due_at.isoformat()},
        )
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def update_task(self, task_id: uuid.UUID, data: TaskUpdate, actor_user_id: uuid.UUID) -> Optional[Task]:
        task = await self.get_task(task_id)
        if not task:
            return None

        changes = data.model_dump(exclude_unset=True)
        reassigned = "assigned_to_user_id" in changes and changes["assigned_to_user_id"] != task.assigned_to_user_id
        for field, value in changes.items():
            setattr(task, field, value)

        # Editing the due date or the reminder settings means any
        # already-fired reminder for the old time is stale — reset so
        # dispatch_due_reminders re-evaluates it against the new due_at.
        if "due_at" in changes or "reminder_minutes_before" in changes:
            task.reminder_sent = False

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=task.branch_id, module="tasks",
            action="reassigned" if reassigned else "updated", entity_type="task", entity_id=str(task.id),
        )
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def complete_task(self, task_id: uuid.UUID, actor_user_id: uuid.UUID) -> Optional[Task]:
        task = await self.get_task(task_id)
        if not task:
            return None
        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)
        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=task.branch_id, module="tasks",
            action="completed", entity_type="task", entity_id=str(task.id),
        )

        if task.recurrence:
            next_due = _advance_due_date(task.due_at, task.recurrence)
            if not task.recurrence_until or next_due <= task.recurrence_until:
                self.db.add(Task(
                    branch_id=task.branch_id,
                    assigned_to_user_id=task.assigned_to_user_id,
                    created_by_user_id=task.created_by_user_id,
                    title=task.title,
                    description=task.description,
                    task_type=task.task_type,
                    entity_type=task.entity_type,
                    entity_id=task.entity_id,
                    due_at=next_due,
                    all_day=task.all_day,
                    location=task.location,
                    reminder_minutes_before=task.reminder_minutes_before,
                    reminder_channel=task.reminder_channel,
                    recurrence=task.recurrence,
                    recurrence_until=task.recurrence_until,
                    recurrence_parent_id=task.recurrence_parent_id or task.id,
                ))

        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def cancel_task(self, task_id: uuid.UUID, actor_user_id: uuid.UUID) -> Optional[Task]:
        task = await self.get_task(task_id)
        if not task:
            return None
        task.status = "cancelled"
        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=task.branch_id, module="tasks",
            action="cancelled", entity_type="task", entity_id=str(task.id),
        )
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def dispatch_due_reminders(self, *, now: Optional[datetime] = None) -> int:
        """Scans for pending tasks whose reminder window has arrived and
        haven't fired yet, dispatches each, and marks it sent. Meant to
        be called by a scheduled job (cron/Celery beat/etc.) hitting
        POST /tasks/dispatch-reminders — this function itself has no
        opinion on scheduling, only on what "due" means. Returns the
        count dispatched, for the caller/cron log."""
        now = now or datetime.now(timezone.utc)

        result = await self.db.execute(
            select(Task).where(
                Task.deleted_at.is_(None),
                Task.status == "pending",
                Task.reminder_sent.is_(False),
                Task.reminder_minutes_before.is_not(None),
            )
        )
        candidates = list(result.scalars().all())

        dispatched = 0
        for task in candidates:
            remind_at = task.due_at - timedelta(minutes=task.reminder_minutes_before)
            if remind_at > now:
                continue
            await dispatch_task_reminder(self.db, task)
            task.reminder_sent = True
            dispatched += 1

        if dispatched:
            await self.db.commit()
        return dispatched
