import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class NotificationCreate(BaseModel):
    user_id: uuid.UUID
    title: str
    body: Optional[str] = None
    type: str = "info"
    link: Optional[str] = None
    send_email: bool = False


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    body: Optional[str]
    type: str
    link: Optional[str]
    is_read: bool
    created_at: datetime
