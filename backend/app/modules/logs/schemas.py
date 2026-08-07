import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ActivityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    actor_user_id: Optional[uuid.UUID]
    branch_id: Optional[uuid.UUID]
    module: str
    action: str
    entity_type: str
    entity_id: str
    metadata_json: Optional[dict]
    created_at: datetime


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    actor_user_id: Optional[uuid.UUID]
    branch_id: Optional[uuid.UUID]
    action: str
    entity_type: str
    entity_id: str
    before_json: Optional[dict]
    after_json: Optional[dict]
    created_at: datetime
