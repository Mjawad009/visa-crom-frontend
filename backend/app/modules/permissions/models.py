"""
Permission Engine — Core Platform module.

Design: permissions are fine-grained string keys, e.g. "leads.view_all",
"finance.approve_invoice", "documents.delete". Roles are collections of
permissions. Users have exactly one role (kept simple on purpose — a
user acting across two roles should get two accounts, which keeps audit
trails unambiguous). A `is_superuser` escape hatch exists only for CEO
so nothing is ever permanently locked out.

Every module registers the permission keys it introduces (see
Module.permissions in app/core/module_registry.py) — this table is the
single source of truth for "what can possibly be permitted", and
role_permissions is the single source of truth for "who currently can".
"""
import uuid

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Role(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "roles"

    key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # e.g. "branch_manager"
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "Branch Manager"
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)  # system roles can't be deleted

    permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )


class Permission(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "permissions"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # "leads.view_all"
    module: Mapped[str] = mapped_column(String(50), nullable=False)  # "leads"
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"))
    permission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permissions.id"))

    role: Mapped["Role"] = relationship(back_populates="permissions")
    permission: Mapped["Permission"] = relationship()
