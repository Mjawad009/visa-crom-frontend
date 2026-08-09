import uuid
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.workflow.models import (
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowInstanceHistory,
    WorkflowStage,
    WorkflowTransition,
)
from app.modules.workflow.schemas import WorkflowDefinitionCreate
from app.shared.activity import log_activity


class WorkflowError(Exception):
    pass


class InvalidTransitionError(WorkflowError):
    pass


class WorkflowEngineService:
    """Public interface business modules use to drive their pipelines
    (e.g. Cases module calls `start_instance` when a case is created and
    `apply_transition` when staff move it forward) — no module reimplements
    stage logic itself."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ---- Definition authoring (workflow.manage_definitions) ----

    async def create_definition(self, data: WorkflowDefinitionCreate) -> WorkflowDefinition:
        definition = WorkflowDefinition(key=data.key, name=data.name, module=data.module)
        self.db.add(definition)
        await self.db.flush()

        stage_by_key = {}
        for s in data.stages:
            stage = WorkflowStage(
                definition_id=definition.id, key=s.key, name=s.name, order=s.order, is_terminal=s.is_terminal
            )
            self.db.add(stage)
            await self.db.flush()
            stage_by_key[s.key] = stage

        for t in data.transitions:
            self.db.add(
                WorkflowTransition(
                    definition_id=definition.id,
                    from_stage_id=stage_by_key[t.from_stage_key].id,
                    to_stage_id=stage_by_key[t.to_stage_key].id,
                    key=t.key,
                    name=t.name,
                    required_permission=t.required_permission,
                )
            )

        await self.db.commit()
        await self.db.refresh(definition)
        return definition

    async def get_definition_by_key(self, key: str) -> Optional[WorkflowDefinition]:
        result = await self.db.execute(select(WorkflowDefinition).where(WorkflowDefinition.key == key))
        return result.scalar_one_or_none()

    async def list_definitions(self) -> List[WorkflowDefinition]:
        result = await self.db.execute(select(WorkflowDefinition))
        return list(result.scalars().all())

    # ---- Instance lifecycle (called by business modules) ----

    async def start_instance(
        self, definition_key: str, entity_type: str, entity_id: str, branch_id: Optional[uuid.UUID], actor_user_id: Optional[uuid.UUID]
    ) -> WorkflowInstance:
        definition = await self.get_definition_by_key(definition_key)
        if not definition:
            raise WorkflowError(f"Unknown workflow definition: {definition_key}")

        stages_result = await self.db.execute(
            select(WorkflowStage).where(WorkflowStage.definition_id == definition.id).order_by(WorkflowStage.order)
        )
        first_stage = stages_result.scalars().first()
        if not first_stage:
            raise WorkflowError("Workflow definition has no stages")

        instance = WorkflowInstance(
            definition_id=definition.id,
            entity_type=entity_type,
            entity_id=entity_id,
            current_stage_id=first_stage.id,
            branch_id=branch_id,
        )
        self.db.add(instance)
        await self.db.flush()

        self.db.add(
            WorkflowInstanceHistory(
                instance_id=instance.id, from_stage_id=None, to_stage_id=first_stage.id,
                transitioned_by_user_id=actor_user_id, note="Workflow started",
            )
        )
        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=branch_id, module="workflow",
            action="started", entity_type=entity_type, entity_id=entity_id,
            metadata={"definition": definition_key, "stage": first_stage.key},
        )
        await self.db.commit()
        await self.db.refresh(instance)
        return instance

    async def apply_transition(
        self, instance_id: uuid.UUID, transition_key: str, actor_user_id: Optional[uuid.UUID], note: Optional[str] = None
    ) -> WorkflowInstance:
        instance = await self.db.get(WorkflowInstance, instance_id)
        if not instance:
            raise WorkflowError("Workflow instance not found")

        transition_result = await self.db.execute(
            select(WorkflowTransition).where(
                WorkflowTransition.definition_id == instance.definition_id,
                WorkflowTransition.key == transition_key,
                WorkflowTransition.from_stage_id == instance.current_stage_id,
            )
        )
        transition = transition_result.scalar_one_or_none()
        if not transition:
            raise InvalidTransitionError(
                f"Transition '{transition_key}' is not valid from the current stage"
            )

        instance.current_stage_id = transition.to_stage_id
        self.db.add(
            WorkflowInstanceHistory(
                instance_id=instance.id, from_stage_id=transition.from_stage_id,
                to_stage_id=transition.to_stage_id, transitioned_by_user_id=actor_user_id, note=note,
            )
        )
        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=instance.branch_id, module="workflow",
            action="transitioned", entity_type=instance.entity_type, entity_id=instance.entity_id,
            metadata={"transition": transition_key},
        )
        await self.db.commit()
        await self.db.refresh(instance)
        return instance

    async def get_instance_for_entity(self, entity_type: str, entity_id: str) -> Optional[WorkflowInstance]:
        result = await self.db.execute(
            select(WorkflowInstance).where(
                WorkflowInstance.entity_type == entity_type, WorkflowInstance.entity_id == entity_id
            )
        )
        return result.scalar_one_or_none()

    async def get_stages_for_entities(self, entity_type: str, entity_ids: List[str]) -> dict:
        """Batch version of get_instance_for_entity + a stage lookup,
        combined into one query. Fixes a real N+1: every list_* method in
        Leads/Cases/Admissions was calling the single-entity lookup once
        per row (1 + 2N queries for a page of N). This is 1 query
        regardless of list size. Returns {entity_id: (stage_key, stage_name)}."""
        if not entity_ids:
            return {}
        result = await self.db.execute(
            select(WorkflowInstance.entity_id, WorkflowStage.key, WorkflowStage.name)
            .join(WorkflowStage, WorkflowStage.id == WorkflowInstance.current_stage_id)
            .where(WorkflowInstance.entity_type == entity_type, WorkflowInstance.entity_id.in_(entity_ids))
        )
        return {entity_id: (stage_key, stage_name) for entity_id, stage_key, stage_name in result.all()}

    async def get_stage_counts(self, definition_key: str) -> List[dict]:
        """Count active workflow instances per stage, in stage order.
        Generic on purpose — Reports & Analytics (Phase 13) uses this for
        every pipeline's funnel view (Leads, Cases, Admissions) without
        Reports needing to know anything about what a "lead" or "case" is."""
        definition = await self.get_definition_by_key(definition_key)
        if not definition:
            return []

        stages_result = await self.db.execute(
            select(WorkflowStage).where(WorkflowStage.definition_id == definition.id).order_by(WorkflowStage.order)
        )
        stages = list(stages_result.scalars().all())

        counts = []
        for stage in stages:
            count_result = await self.db.execute(
                select(func.count()).select_from(WorkflowInstance).where(WorkflowInstance.current_stage_id == stage.id)
            )
            counts.append({"stage_key": stage.key, "stage_name": stage.name, "count": count_result.scalar_one()})
        return counts
