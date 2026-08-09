import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Notification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """In-app notification. Delivery to email/SMS is a separate concern
    (handled by app/shared/email.py calling Resend) — this table is only
    the in-app inbox."""

    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    type: Mapped[str] = mapped_column(String(50), default="info")  # info | warning | action_required
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)  # deep link within the app
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
