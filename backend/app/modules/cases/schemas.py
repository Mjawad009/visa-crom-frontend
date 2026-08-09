import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CaseCreate(BaseModel):
    client_id: uuid.UUID
    case_type: str
    destination_country: Optional[str] = None
    visa_type: Optional[str] = None
    priority: str = "normal"
    target_submission_date: Optional[date] = None
    notes: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_consultant_id: Optional[uuid.UUID] = None


class CaseUpdate(BaseModel):
    case_type: Optional[str] = None
    destination_country: Optional[str] = None
    visa_type: Optional[str] = None
    priority: Optional[str] = None
    target_submission_date: Optional[date] = None
    notes: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_consultant_id: Optional[uuid.UUID] = None


class CaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    branch_id: Optional[uuid.UUID]
    assigned_consultant_id: Optional[uuid.UUID]
    reference: str
    case_type: str
    destination_country: Optional[str]
    visa_type: Optional[str]
    priority: str
    target_submission_date: Optional[date]
    notes: Optional[str]
    is_closed: bool
    closed_reason: Optional[str]
    created_at: datetime
    current_stage_key: Optional[str] = None
    current_stage_name: Optional[str] = None
    client_full_name: Optional[str] = None


class CaseTransitionRequest(BaseModel):
    transition_key: str
    note: Optional[str] = None
