"""
Leads — first Business Module (Phase 4).

Deliberately thin: a Lead record holds contact/source facts only. Its
pipeline position (New -> Contacted -> Qualified -> Proposal Sent ->
Converted / Lost) is tracked by the Workflow Engine (Phase 2) via a
WorkflowInstance keyed on entity_type="lead" — this module never stores
its own "status" column, so there is exactly one place pipeline state
lives, reusable by every later module the same way.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Lead(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "leads"

    # Nullable: a lead can arrive centrally (e.g. website form) before
    # being triaged to a branch.
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True, index=True)
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    source: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    # e.g. "website", "referral", "social_media", "walk_in", "agent", "other"

    country_of_interest: Mapped[str | None] = mapped_column(String(100), nullable=True)
    visa_type_interest: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_converted: Mapped[bool] = mapped_column(Boolean, default=False)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
