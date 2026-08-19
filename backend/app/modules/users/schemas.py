import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role_id: uuid.UUID
    branch_id: Optional[uuid.UUID] = None
    additional_role_ids: List[uuid.UUID] = []


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role_id: Optional[uuid.UUID] = None
    branch_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None
    # None = leave additional roles untouched; [] = clear them; a list =
    # replace the full set. Distinguished via exclude_unset in the
    # service, same pattern PATCH already uses for every other field.
    additional_role_ids: Optional[List[uuid.UUID]] = None


class PasswordResetRequest(BaseModel):
    new_password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    phone: Optional[str]
    role_id: uuid.UUID
    branch_id: Optional[uuid.UUID]
    is_active: bool
    additional_role_ids: List[uuid.UUID] = []
