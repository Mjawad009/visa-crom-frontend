"""
Tasks & Calendar — Phase 18.

Deliberately follows the same discipline as every business module before
it: thin model, ownership scoping via view/view_all, generic
(entity_type, entity_id) linkage so a task can optionally attach to a
Lead, Client, Case, or Admission without Tasks needing to import any of
those modules (same pattern as Files/Communications).

Unlike Leads/Cases/Admissions, a task's lifecycle (pending -> completed /
cancelled) is simple enough that it does NOT need the Workflow Engine —
three states with no branching stages would be overkill for that engine.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Task(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tasks"

    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True, index=True
    )
    assigned_to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # "task" | "call" | "meeting" | "appointment" | "follow_up"
    task_type: Mapped[str] = mapped_column(String(30), nullable=False, default="task")

    # Optional link to any other module's record — same generic pattern
    # as FileRecord/CommunicationLog. Tasks has zero awareness of what
    # "lead" or "case" actually means; it just stores the pointer.
    entity_type: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)  # appointments only

    # "pending" | "completed" | "cancelled"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Reminders ---
    # How long before due_at to remind the assignee. Null = no reminder.
    reminder_minutes_before: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # "in_app" | "email" | "sms" | "whatsapp". sms/whatsapp are accepted
    # today but only produce an in-app notification until a provider is
    # configured — see app/shared/reminders.py.
    reminder_channel: Mapped[str] = mapped_column(String(20), nullable=False, default="in_app")
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)

    # --- Recurrence ---
    # "daily" | "weekly" | "monthly" | None. When a recurring task is
    # completed, TaskService spawns the next occurrence automatically —
    # see complete_task. recurrence_parent_id links occurrences together
    # so the UI can show "part of a recurring series" without needing a
    # separate series table.
    recurrence: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recurrence_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recurrence_parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True
    )
