"""
File Service -> Document Management — Core Platform module.

Phase 2 shipped the generic file/metadata record and upload/download
flow (FileRecord's original fields). Phase 7 extends the same table
rather than splitting into a separate module, per the plan noted in
Phase 6: documents are files with more structure around them (folders,
categories, versions, OCR, AI analysis, expiry) — not a different kind
of object.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class DocumentFolder(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Folder hierarchy, scoped to one entity (a case or a client).
    Self-referencing parent_folder_id gives arbitrary nesting."""

    __tablename__ = "document_folders"

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    parent_folder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("document_folders.id"), nullable=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)


class DocumentCategory(Base, UUIDPrimaryKeyMixin):
    """Reference table of document categories (passport, bank statement,
    offer letter, ...). Not hardcoded in Python — editable data, seeded
    with sensible defaults in seed.py."""

    __tablename__ = "document_categories"

    key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expiry_tracking_enabled: Mapped[bool] = mapped_column(Boolean, default=False)


class FileRecord(Base, UUIDPrimaryKeyMixin, SoftDeleteMixin):
    __tablename__ = "files"
    __table_args__ = (
        Index("ix_files_entity", "entity_type", "entity_id"),
        Index("ix_files_status", "status"),
        Index("ix_files_expiry_date", "expiry_date"),
    )

    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    uploaded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "client", "case", ...
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    folder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("document_folders.id"), nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)  # references DocumentCategory.key by convention

    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # --- Version history ---
    version: Mapped[int] = mapped_column(Integer, default=1)
    previous_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("files.id"), nullable=True)

    # --- Approval workflow ---
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | verified | rejected | superseded
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # --- OCR + AI analysis ---
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # --- Expiry tracking ---
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
