import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.files.schemas import (
    CategoryRead,
    FileRead,
    FileVerifyRequest,
    FolderCreate,
    FolderRead,
    NewVersionRequest,
    ProcessDocumentResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.modules.files.service import FileNotFoundErrorService, FileService, PreviousVersionNotFoundError
from app.shared.ocr import OCRUnsupportedError

router = APIRouter()


def _can_download(record, current_user: CurrentUser) -> bool:
    """Known simplification: download access is granted to the uploader,
    anyone with files.verify (documentation/processing staff review
    everything), or a superuser. A full case-team ACL (only the case's
    assigned consultant + reviewers) is a reasonable Phase 16 follow-up
    once role boundaries in production usage are better understood."""
    if current_user.is_superuser:
        return True
    if record.uploaded_by_user_id == current_user.id:
        return True
    return "files.verify" in current_user.permissions


@router.post("/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    payload: UploadUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("files.upload")),
):
    record, upload_url = await FileService(db).create_upload_url(payload, actor_user_id=current_user.id)
    return UploadUrlResponse(file_id=record.id, upload_url=upload_url, storage_key=record.storage_key)


@router.post("/{file_id}/new-version", response_model=UploadUrlResponse)
async def create_new_version(
    file_id: uuid.UUID,
    payload: NewVersionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("files.upload")),
):
    try:
        record, upload_url = await FileService(db).create_new_version(file_id, payload, actor_user_id=current_user.id)
    except PreviousVersionNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Original document not found")
    return UploadUrlResponse(file_id=record.id, upload_url=upload_url, storage_key=record.storage_key)


@router.get("/", response_model=list[FileRead])
async def list_files_for_entity(
    entity_type: str,
    entity_id: str,
    folder_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await FileService(db).list_for_entity(entity_type, entity_id, folder_id)


@router.get("/search", response_model=list[FileRead])
async def search_files(
    q: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await FileService(db).search(q, entity_type, entity_id)


@router.get("/expiring", response_model=list[FileRead])
async def get_expiring_files(
    within_days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("files.verify")),
):
    return await FileService(db).list_expiring(within_days)


@router.get("/categories", response_model=list[CategoryRead])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await FileService(db).list_categories()


@router.post("/folders", response_model=FolderRead, status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: FolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("files.upload")),
):
    return await FileService(db).create_folder(payload)


@router.get("/folders", response_model=list[FolderRead])
async def list_folders(
    entity_type: str,
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await FileService(db).list_folders(entity_type, entity_id)


@router.get("/{file_id}/download-url")
async def get_download_url(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    service = FileService(db)
    record = await service.get_file(file_id)
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    if not _can_download(record, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this file")

    url = await service.get_download_url(file_id)
    return {"download_url": url}


@router.post("/{file_id}/process", response_model=ProcessDocumentResponse)
async def process_document(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("files.verify")),
):
    try:
        record = await FileService(db).process_document(file_id, actor_user_id=current_user.id)
    except FileNotFoundErrorService:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    return ProcessDocumentResponse(ocr_text=record.ocr_text or "", ai_analysis=record.ai_analysis or {})


@router.post("/{file_id}/verify", response_model=FileRead)
async def verify_file(
    file_id: uuid.UUID,
    payload: FileVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("files.verify")),
):
    if payload.status not in ("verified", "rejected"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "status must be 'verified' or 'rejected'")
    record = await FileService(db).verify(file_id, payload.status, current_user.id, payload.note)
    if not record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    return record


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("files.delete")),
):
    deleted = await FileService(db).soft_delete(file_id, current_user.id)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
