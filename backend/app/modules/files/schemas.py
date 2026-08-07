import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class UploadUrlRequest(BaseModel):
    entity_type: str
    entity_id: str
    filename: str
    content_type: str
    category: Optional[str] = None
    folder_id: Optional[uuid.UUID] = None
    branch_id: Optional[uuid.UUID] = None
    expiry_date: Optional[date] = None


class UploadUrlResponse(BaseModel):
    file_id: uuid.UUID
    upload_url: str
    storage_key: str


class FileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    entity_type: str
    entity_id: str
    folder_id: Optional[uuid.UUID]
    category: Optional[str]
    filename: str
    content_type: str
    size_bytes: Optional[int]
    version: int
    previous_version_id: Optional[uuid.UUID]
    status: str
    rejection_reason: Optional[str]
    ocr_text: Optional[str]
    ai_analysis: Optional[dict[str, Any]]
    expiry_date: Optional[date]
    created_at: datetime


class FileVerifyRequest(BaseModel):
    status: str  # "verified" | "rejected"
    note: Optional[str] = None


class NewVersionRequest(BaseModel):
    filename: str
    content_type: str


class FolderCreate(BaseModel):
    entity_type: str
    entity_id: str
    name: str
    parent_folder_id: Optional[uuid.UUID] = None
    branch_id: Optional[uuid.UUID] = None


class FolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    entity_type: str
    entity_id: str
    name: str
    parent_folder_id: Optional[uuid.UUID]


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    key: str
    name: str
    description: Optional[str]
    expiry_tracking_enabled: bool


class ProcessDocumentResponse(BaseModel):
    ocr_text: str
    ai_analysis: dict[str, Any]
