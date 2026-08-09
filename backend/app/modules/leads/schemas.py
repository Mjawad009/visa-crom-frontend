import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class LeadCreate(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    source: str = "other"
    country_of_interest: Optional[str] = None
    visa_type_interest: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_to_user_id: Optional[uuid.UUID] = None


class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    country_of_interest: Optional[str] = None
    visa_type_interest: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_to_user_id: Optional[uuid.UUID] = None


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: Optional[uuid.UUID]
    assigned_to_user_id: Optional[uuid.UUID]
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    source: str
    country_of_interest: Optional[str]
    visa_type_interest: Optional[str]
    notes: Optional[str]
    is_converted: bool
    created_at: datetime
    current_stage_key: Optional[str] = None
    current_stage_name: Optional[str] = None


class LeadTransitionRequest(BaseModel):
    transition_key: str
    note: Optional[str] = None
