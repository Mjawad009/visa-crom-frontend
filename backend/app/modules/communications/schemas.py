import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, model_validator


class CommunicationCreate(BaseModel):
    entity_type: str
    entity_id: str
    channel: str  # "email" | "internal_note"
    subject: Optional[str] = None
    body: str
    recipient_email: Optional[EmailStr] = None
    branch_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def validate_email_has_recipient(self):
        if self.channel == "email" and not self.recipient_email:
            raise ValueError("recipient_email is required when channel is 'email'")
        return self


class CommunicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: str
    entity_id: str
    channel: str
    direction: str
    sender_user_id: Optional[uuid.UUID]
    recipient_email: Optional[str]
    subject: Optional[str]
    body: str
    created_at: datetime
