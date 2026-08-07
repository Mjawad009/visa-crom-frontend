"""
Admissions - Business Module (Phase 10).

Tracks a client's application to a specific institution/program -
distinct from the visa Case pipeline (Phase 6), which it typically runs
alongside for study-visa clients (an offer letter from here often
becomes eligibility evidence over there). Deliberately not linked to
Case directly: keeping Admissions dependent only on Clients (same
public-interface pattern as Leads and Cases) avoids a case<->admissions
coupling neither module needs yet. If a future phase needs that link,
it's one field and one read from cases/public.py - not a redesign.

Same discipline as every business module so far: no status column here,
pipeline position lives entirely in a WorkflowInstance.
"""
import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AdmissionApplication(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "admission_applications"

    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True, index=True)
    assigned_officer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    institution_name: Mapped[str] = mapped_column(String(200), nullable=False)
    program_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    intake_term: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    closed_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
