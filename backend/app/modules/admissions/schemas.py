import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AdmissionApplicationCreate(BaseModel):
    client_id: uuid.UUID
    institution_name: str
    program_name: Optional[str] = None
    country: Optional[str] = None
    intake_term: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_officer_id: Optional[uuid.UUID] = None


class AdmissionApplicationUpdate(BaseModel):
    institution_name: Optional[str] = None
    program_name: Optional[str] = None
    country: Optional[str] = None
    intake_term: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_officer_id: Optional[uuid.UUID] = None


class AdmissionApplicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    branch_id: Optional[uuid.UUID]
    assigned_officer_id: Optional[uuid.UUID]
    institution_name: str
    program_name: Optional[str]
    country: Optional[str]
    intake_term: Optional[str]
    notes: Optional[str]
    is_closed: bool
    closed_reason: Optional[str]
    created_at: datetime
    current_stage_key: Optional[str] = None
    current_stage_name: Optional[str] = None
    client_full_name: Optional[str] = None


class AdmissionTransitionRequest(BaseModel):
    transition_key: str
    note: Optional[str] = None
