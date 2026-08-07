import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class ClientCreate(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    passport_number: Optional[str] = None
    passport_expiry: Optional[date] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_consultant_id: Optional[uuid.UUID] = None
    lead_id: Optional[uuid.UUID] = None  # if set, must reference an already-converted lead


class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = None
    passport_number: Optional[str] = None
    passport_expiry: Optional[date] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[uuid.UUID] = None
    assigned_consultant_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None
    user_id: Optional[uuid.UUID] = None  # link/unlink this client to a login account (Phase 14)


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: Optional[uuid.UUID]
    assigned_consultant_id: Optional[uuid.UUID]
    lead_id: Optional[uuid.UUID]
    user_id: Optional[uuid.UUID]
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    date_of_birth: Optional[date]
    nationality: Optional[str]
    passport_number: Optional[str]
    passport_expiry: Optional[date]
    address: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime
