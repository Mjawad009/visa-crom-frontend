"""
Workflow Engine — Core Platform module.

Generic enough that Leads, Cases, Visa Processing, and Admissions all
reuse it instead of hardcoding their own pipeline logic. A
WorkflowDefinition is a named pipeline (e.g. "standard_visa_case") made
of ordered Stages and the Transitions allowed between them. A
WorkflowInstance attaches one definition to one entity (e.g. a specific
Case row) and tracks its current stage; WorkflowInstanceHistory is the
append-only trail of every move.

No stage names or transition rules are hardcoded in Python — they are
rows, editable by anyone with `workflow.manage_definitions`.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorkflowDefinition(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "workflow_definitions"

    key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)  # "standard_visa_case"
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    module: Mapped[str] = mapped_column(String(50), nullable=False)  # which business module owns this pipeline
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    stages: Mapped[list["WorkflowStage"]] = relationship(back_populates="definition", cascade="all, delete-orphan")


class WorkflowStage(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "workflow_stages"

    definition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflow_definitions.id"))
    key: Mapped[str] = mapped_column(String(80), nullable=False)  # "document_collection"
    name: Mapped[str] = mapped_column(String(150), nullable=False)  # "Document Collection"
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False)  # e.g. "Decision", "Post Visa Support"

    definition: Mapped["WorkflowDefinition"] = relationship(back_populates="stages")


class WorkflowTransition(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "workflow_transitions"

    definition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflow_definitions.id"))
    from_stage_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflow_stages.id"))
    to_stage_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflow_stages.id"))
    key: Mapped[str] = mapped_column(String(80), nullable=False)  # "submit_application"
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    required_permission: Mapped[str | None] = mapped_column(String(100), nullable=True)  # gate who can trigger it


class WorkflowInstance(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Binds one WorkflowDefinition to one business entity (a lead, a case, ...)."""

    __tablename__ = "workflow_instances"
    __table_args__ = (Index("ix_workflow_instances_entity", "entity_type", "entity_id"),)

    definition_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflow_definitions.id"))
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "case"
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    current_stage_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflow_stages.id"))
    branch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)


class WorkflowInstanceHistory(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "workflow_instance_history"

    instance_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflow_instances.id"), index=True)
    from_stage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workflow_stages.id"), nullable=True)
    to_stage_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflow_stages.id"))
    transitioned_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
