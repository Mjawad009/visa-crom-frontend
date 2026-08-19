import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class UserRole(Base):
    """Many-to-many: a user's *additional* roles, on top of their single
    primary `role_id` on User. Kept as a separate table rather than
    replacing role_id outright so nothing about portal routing
    (role_routes.ts keys off one role_key) or the existing role_id FK
    has to change — additional roles are purely additive to the
    permission set."""

    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True)


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True
    )  # nullable: CEO / client-portal users may not be tied to one branch
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)  # reserved for CEO break-glass access
    last_login_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    role: Mapped["Role"] = relationship(foreign_keys=[role_id])  # noqa: F821 (typed via string to avoid import cycle)
    # Additional roles beyond the primary one. Permissions are the union
    # of the primary role's grants and every additional role's grants —
    # see core/deps.py get_current_user.
    additional_roles: Mapped[list["Role"]] = relationship(  # noqa: F821
        secondary="user_roles", lazy="raise"
    )

    @property
    def additional_role_ids(self) -> list[uuid.UUID]:
        """Lets UserRead pick this straight off the ORM object like any
        other field. Requires additional_roles to have been eagerly
        loaded (selectinload) by whoever queried this user — see
        users/service.py — since the relationship itself is
        lazy='raise' to make a missing eager-load fail loudly instead
        of silently doing sync IO on an async session."""
        return [r.id for r in self.additional_roles]
