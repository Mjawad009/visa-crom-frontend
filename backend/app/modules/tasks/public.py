"""
Tasks — public interface.

Same discipline as every other module: anything outside Tasks that
needs task data imports only from here, never from tasks.models or
tasks.service directly.
"""
import uuid
from typing import Dict

from sqlalchemy.ext.asyncio import AsyncSession


async def get_open_task_count_for_user(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Used by role portals (Consultant/Visa Processing/Admissions) to
    show a lightweight 'X open tasks' stat without those pages needing
    to know anything about Task's schema."""
    from sqlalchemy import func, select

    from app.modules.tasks.models import Task

    result = await db.execute(
        select(func.count()).where(
            Task.deleted_at.is_(None),
            Task.status == "pending",
            Task.assigned_to_user_id == user_id,
        )
    )
    return result.scalar_one()


async def get_task_counts_by_branch(db: AsyncSession) -> Dict[str, int]:
    """Counts only, grouped by branch — for Reports & Analytics, same
    shape as every other module's *_counts_by_branch function."""
    from sqlalchemy import func, select

    from app.modules.tasks.models import Task

    result = await db.execute(
        select(Task.branch_id, func.count())
        .where(Task.deleted_at.is_(None), Task.status == "pending")
        .group_by(Task.branch_id)
    )
    return {str(branch_id) if branch_id else "unassigned": count for branch_id, count in result.all()}
