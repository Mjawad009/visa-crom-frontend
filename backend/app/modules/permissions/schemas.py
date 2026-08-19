import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    key: str
    name: str
    description: Optional[str]
    is_system: bool


class RoleCreate(BaseModel):
    key: str
    name: str
    description: Optional[str] = None


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    key: str
    module: str
    description: Optional[str]


class RolePermissionsUpdate(BaseModel):
    permission_keys: List[str]
