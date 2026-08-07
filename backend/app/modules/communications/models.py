"""
Communications - Business Module (Phase 11).

A single timeline of emails sent and internal notes left against any
entity (lead, client, case, admission) - same generic
(entity_type, entity_id) pattern Files established in Phase 2/7. Emails
actually go out via app/shared/email.py (Resend, Phase 2); internal
notes never leave the system. Both land in the same table so a detail
page can render one unified history instead of two separate widgets.

Known simplification: authorization here is a flat company-wide
communication.view / communication.send permission, not a per-entity
ownership check against whatever module owns entity_type. Enforcing
"only the assigned consultant can see this specific case's emails"
would mean Communications importing every business module's ownership
rules - a bigger coupling problem than the gap is worth solving right
now. Documented here rather than solved speculatively, same call as the
file-download ACL simplification in Phase 7.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class CommunicationLog(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "communication_logs"
    __table_args__ = (Index("ix_communication_logs_entity", "entity_type", "entity_id"),)

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)

    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)

    sender_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    recipient_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
