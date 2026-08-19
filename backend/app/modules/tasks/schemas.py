import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator

TaskType = Literal["task", "call", "meeting", "appointment", "follow_up"]
ReminderChannel = Literal["in_app", "email", "sms", "whatsapp"]
TaskStatus = Literal["pending", "completed", "cancelled"]
RecurrenceRule = Literal["daily", "weekly", "monthly"]


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: TaskType = "task"
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    due_at: datetime
    all_day: bool = False
    location: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_to_user_id: Optional[uuid.UUID] = None  # defaults to the creator if omitted
    reminder_minutes_before: Optional[int] = None
    reminder_channel: ReminderChannel = "in_app"
    recurrence: Optional[RecurrenceRule] = None
    recurrence_until: Optional[datetime] = None

    @field_validator("reminder_minutes_before")
    @classmethod
    def _positive_reminder(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("reminder_minutes_before must be >= 0")
        return v


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[TaskType] = None
    due_at: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_to_user_id: Optional[uuid.UUID] = None
    reminder_minutes_before: Optional[int] = None
    reminder_channel: Optional[ReminderChannel] = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: Optional[uuid.UUID]
    assigned_to_user_id: uuid.UUID
    created_by_user_id: uuid.UUID
    title: str
    description: Optional[str]
    task_type: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    due_at: datetime
    all_day: bool
    location: Optional[str]
    status: str
    completed_at: Optional[datetime]
    reminder_minutes_before: Optional[int]
    reminder_channel: str
    reminder_sent: bool
    recurrence: Optional[str]
    recurrence_until: Optional[datetime]
    recurrence_parent_id: Optional[uuid.UUID]
    created_at: datetime
