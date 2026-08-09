import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MyProfile(BaseModel):
    id: uuid.UUID
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    nationality: Optional[str]
    passport_number: Optional[str]
    passport_expiry: Optional[str]


class MyCase(BaseModel):
    id: uuid.UUID
    case_type: str
    destination_country: Optional[str]
    visa_type: Optional[str]
    current_stage_key: Optional[str]
    current_stage_name: Optional[str]


class MyAdmission(BaseModel):
    id: uuid.UUID
    institution_name: str
    program_name: Optional[str]
    country: Optional[str]
    intake_term: Optional[str]
    current_stage_key: Optional[str]
    current_stage_name: Optional[str]


class MyDocument(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    category: Optional[str]
    filename: str
    status: str
    expiry_date: Optional[str]
    created_at: datetime


class MyCommunication(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    subject: Optional[str]
    body: str
    created_at: datetime
