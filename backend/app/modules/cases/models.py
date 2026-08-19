"""
Cases - Business Module (Phase 6).

This is the module the master spec's real pipeline is for: Consultation
-> Document Collection -> Eligibility Review -> Application ->
Submission -> Biometrics -> Medical -> Interview -> Decision -> Post
Visa Support. Like Lead, Case stores no status/stage column itself -
that lives entirely in a WorkflowInstance (Phase 2), seeded as the
`visa_case_pipeline` definition (see seed.py). Documents (Phase 7) will
attach to a case the same way Files already attach to any
(entity_type, entity_id) pair.
"""
import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Case(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "cases"

    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True, index=True)
    assigned_consultant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    reference: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    case_type: Mapped[str] = mapped_column(String(50), nullable=False)
    destination_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    visa_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    target_submission_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    closed_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
