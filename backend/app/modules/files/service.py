import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.files.models import DocumentCategory, DocumentFolder, FileRecord
from app.modules.files.schemas import FolderCreate, NewVersionRequest, UploadUrlRequest
from app.shared.activity import log_activity
from app.shared.audit import log_audit
from app.shared.document_ai import analyze_document_text
from app.shared.ocr import OCRUnsupportedError, extract_text
from app.shared.storage import (
    build_storage_key,
    delete_object,
    download_object_bytes,
    generate_download_url,
    generate_upload_url,
)


class FileNotFoundErrorService(Exception):
    pass


class PreviousVersionNotFoundError(Exception):
    pass


class FileService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---- Upload / metadata ----

    async def create_upload_url(self, data: UploadUrlRequest, actor_user_id: uuid.UUID) -> tuple[FileRecord, str]:
        storage_key = build_storage_key(data.entity_type, data.entity_id, data.filename)
        record = FileRecord(
            branch_id=data.branch_id,
            uploaded_by_user_id=actor_user_id,
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            folder_id=data.folder_id,
            category=data.category,
            filename=data.filename,
            storage_key=storage_key,
            content_type=data.content_type,
            status="pending",
            expiry_date=data.expiry_date,
        )
        self.db.add(record)
        await self.db.flush()

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=data.branch_id, module="files",
            action="upload_initiated", entity_type=data.entity_type, entity_id=data.entity_id,
            metadata={"file_id": str(record.id), "filename": data.filename, "category": data.category},
        )
        await self.db.commit()
        await self.db.refresh(record)

        upload_url = generate_upload_url(storage_key, data.content_type)
        return record, upload_url

    async def create_new_version(
        self, previous_file_id: uuid.UUID, data: NewVersionRequest, actor_user_id: uuid.UUID
    ) -> tuple[FileRecord, str]:
        previous = await self.db.get(FileRecord, previous_file_id)
        if not previous or previous.deleted_at is not None:
            raise PreviousVersionNotFoundError()

        storage_key = build_storage_key(previous.entity_type, previous.entity_id, data.filename)
        new_record = FileRecord(
            branch_id=previous.branch_id,
            uploaded_by_user_id=actor_user_id,
            entity_type=previous.entity_type,
            entity_id=previous.entity_id,
            folder_id=previous.folder_id,
            category=previous.category,
            filename=data.filename,
            storage_key=storage_key,
            content_type=data.content_type,
            status="pending",
            version=previous.version + 1,
            previous_version_id=previous.id,
            expiry_date=previous.expiry_date,
        )
        previous.status = "superseded"
        self.db.add(new_record)
        await self.db.flush()

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=new_record.branch_id, module="files",
            action="new_version_uploaded", entity_type=new_record.entity_type, entity_id=new_record.entity_id,
            metadata={"file_id": str(new_record.id), "previous_file_id": str(previous.id), "version": new_record.version},
        )
        await self.db.commit()
        await self.db.refresh(new_record)

        upload_url = generate_upload_url(storage_key, data.content_type)
        return new_record, upload_url

    async def list_for_entity(self, entity_type: str, entity_id: str, folder_id: Optional[uuid.UUID] = None) -> List[FileRecord]:
        stmt = select(FileRecord).where(
            FileRecord.entity_type == entity_type,
            FileRecord.entity_id == entity_id,
            FileRecord.deleted_at.is_(None),
        ).order_by(FileRecord.created_at.desc())
        if folder_id is not None:
            stmt = stmt.where(FileRecord.folder_id == folder_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_file(self, file_id: uuid.UUID) -> Optional[FileRecord]:
        record = await self.db.get(FileRecord, file_id)
        if not record or record.deleted_at is not None:
            return None
        return record

    async def get_download_url(self, file_id: uuid.UUID) -> Optional[str]:
        record = await self.get_file(file_id)
        if not record:
            return None
        return generate_download_url(record.storage_key)

    # ---- Approval workflow ----

    async def verify(
        self, file_id: uuid.UUID, new_status: str, actor_user_id: uuid.UUID, note: Optional[str] = None
    ) -> Optional[FileRecord]:
        record = await self.get_file(file_id)
        if not record:
            return None
        record.status = new_status
        if new_status == "rejected":
            record.rejection_reason = note

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=record.branch_id, module="files",
            action=f"marked_{new_status}", entity_type=record.entity_type, entity_id=record.entity_id,
            metadata={"file_id": str(file_id), "note": note},
        )
        await self.db.commit()
        await self.db.refresh(record)
        return record

    async def soft_delete(self, file_id: uuid.UUID, actor_user_id: uuid.UUID) -> bool:
        record = await self.get_file(file_id)
        if not record:
            return False
        record.deleted_at = datetime.now(timezone.utc)

        await log_audit(
            self.db, actor_user_id=actor_user_id, branch_id=record.branch_id,
            action="file_deleted", entity_type=record.entity_type, entity_id=record.entity_id,
            before={"file_id": str(file_id), "filename": record.filename}, after=None,
        )
        await self.db.commit()
        # Object intentionally left in R2 (soft delete only); a scheduled
        # hard-delete job is a Phase 16 (Performance/Infra) candidate.
        return True

    # ---- OCR + AI analysis ----

    async def process_document(self, file_id: uuid.UUID, actor_user_id: uuid.UUID) -> FileRecord:
        record = await self.get_file(file_id)
        if not record:
            raise FileNotFoundErrorService()

        file_bytes = download_object_bytes(record.storage_key)
        try:
            text = extract_text(file_bytes, record.content_type)
        except OCRUnsupportedError as exc:
            text = ""
            record.ai_analysis = {"issues": [str(exc)], "confidence": "low"}
            record.ocr_text = None
            await self.db.commit()
            await self.db.refresh(record)
            return record

        analysis = await analyze_document_text(text, record.category)
        record.ocr_text = text
        record.ai_analysis = analysis

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=record.branch_id, module="files",
            action="processed", entity_type=record.entity_type, entity_id=record.entity_id,
            metadata={"file_id": str(file_id), "confidence": analysis.get("confidence")},
        )
        await self.db.commit()
        await self.db.refresh(record)
        return record

    # ---- Expiry tracking ----

    async def list_expiring(self, within_days: int = 30) -> List[FileRecord]:
        today = date.today()
        cutoff = today + timedelta(days=within_days)
        stmt = select(FileRecord).where(
            FileRecord.deleted_at.is_(None),
            FileRecord.status == "verified",
            FileRecord.expiry_date.is_not(None),
            FileRecord.expiry_date <= cutoff,
            FileRecord.expiry_date >= today,
        ).order_by(FileRecord.expiry_date.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ---- Search ----

    async def search(self, query: str, entity_type: Optional[str] = None, entity_id: Optional[str] = None) -> List[FileRecord]:
        """Pragmatic ILIKE search across filename/category/OCR text. Full
        Meilisearch-backed global search (listed as a Core Platform item)
        is still pending — this covers document search for now without
        blocking Phase 7 on standing up a search cluster."""
        like = f"%{query}%"
        stmt = select(FileRecord).where(
            FileRecord.deleted_at.is_(None),
            (FileRecord.filename.ilike(like)) | (FileRecord.category.ilike(like)) | (FileRecord.ocr_text.ilike(like)),
        )
        if entity_type:
            stmt = stmt.where(FileRecord.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(FileRecord.entity_id == entity_id)
        result = await self.db.execute(stmt.order_by(FileRecord.created_at.desc()).limit(50))
        return list(result.scalars().all())

    # ---- Folders ----

    async def create_folder(self, data: FolderCreate) -> DocumentFolder:
        folder = DocumentFolder(**data.model_dump())
        self.db.add(folder)
        await self.db.commit()
        await self.db.refresh(folder)
        return folder

    async def list_folders(self, entity_type: str, entity_id: str) -> List[DocumentFolder]:
        result = await self.db.execute(
            select(DocumentFolder).where(DocumentFolder.entity_type == entity_type, DocumentFolder.entity_id == entity_id)
        )
        return list(result.scalars().all())

    # ---- Categories ----

    async def list_categories(self) -> List[DocumentCategory]:
        result = await self.db.execute(select(DocumentCategory))
        return list(result.scalars().all())

    async def get_status_counts(self) -> dict:
        """Counts only, grouped by approval status, for Reports & Analytics (Phase 13)."""
        result = await self.db.execute(
            select(FileRecord.status, func.count()).where(FileRecord.deleted_at.is_(None)).group_by(FileRecord.status)
        )
        return {status: count for status, count in result.all()}
