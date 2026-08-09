import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.leads.models import Lead
from app.modules.leads.schemas import LeadCreate, LeadRead, LeadUpdate
from app.modules.workflow.models import WorkflowStage
from app.modules.workflow.service import WorkflowEngineService
from app.shared.activity import log_activity


class LeadNotFoundError(Exception):
    pass


class LeadService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.workflow = WorkflowEngineService(db)

    async def _to_read_model(self, lead: Lead, *, stage: Optional[tuple] = None) -> LeadRead:
        """Attach the lead's current workflow stage — this is the one
        place Leads and the Workflow Engine meet, kept out of the ORM
        model itself. `stage` can be pre-fetched (batch) by list_leads to
        avoid a query per row."""
        if stage is None:
            stage_key = stage_name = None
            instance = await self.workflow.get_instance_for_entity("lead", str(lead.id))
            if instance:
                stage_row = await self.db.get(WorkflowStage, instance.current_stage_id)
                if stage_row:
                    stage_key, stage_name = stage_row.key, stage_row.name
        else:
            stage_key, stage_name = stage

        data = LeadRead.model_validate(lead)
        data.current_stage_key = stage_key
        data.current_stage_name = stage_name
        return data

    async def list_leads(
        self,
        *,
        branch_id: Optional[uuid.UUID] = None,
        assigned_to_user_id: Optional[uuid.UUID] = None,
        restrict_to_user_id: Optional[uuid.UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[LeadRead]:
        """`restrict_to_user_id` is set when the caller only has
        `leads.view` (their own leads), not `leads.view_all`."""
        stmt = select(Lead).where(Lead.deleted_at.is_(None)).order_by(Lead.created_at.desc())
        if branch_id:
            stmt = stmt.where(Lead.branch_id == branch_id)
        if assigned_to_user_id:
            stmt = stmt.where(Lead.assigned_to_user_id == assigned_to_user_id)
        if restrict_to_user_id:
            stmt = stmt.where(Lead.assigned_to_user_id == restrict_to_user_id)
        stmt = stmt.limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        leads = list(result.scalars().all())

        # Batch-fetch stages for the whole page: 1 query instead of N
        # (was a real N+1 before Phase 15).
        stages = await self.workflow.get_stages_for_entities("lead", [str(l.id) for l in leads])
        return [await self._to_read_model(lead, stage=stages.get(str(lead.id))) for lead in leads]

    async def get_lead(self, lead_id: uuid.UUID) -> Optional[Lead]:
        lead = await self.db.get(Lead, lead_id)
        if not lead or lead.deleted_at is not None:
            return None
        return lead

    async def get_lead_read(self, lead_id: uuid.UUID) -> Optional[LeadRead]:
        lead = await self.get_lead(lead_id)
        if not lead:
            return None
        return await self._to_read_model(lead)

    async def create_lead(self, data: LeadCreate, actor_user_id: uuid.UUID) -> LeadRead:
        lead = Lead(**data.model_dump())
        self.db.add(lead)
        await self.db.flush()  # get lead.id

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=lead.branch_id, module="leads",
            action="created", entity_type="lead", entity_id=str(lead.id),
            metadata={"source": lead.source},
        )
        await self.db.commit()
        await self.db.refresh(lead)

        # Every lead starts life in the pipeline immediately.
        await self.workflow.start_instance(
            "lead_pipeline", "lead", str(lead.id), lead.branch_id, actor_user_id=actor_user_id
        )

        return await self._to_read_model(lead)

    async def update_lead(self, lead_id: uuid.UUID, data: LeadUpdate, actor_user_id: uuid.UUID) -> Optional[LeadRead]:
        lead = await self.get_lead(lead_id)
        if not lead:
            return None

        reassigned = (
            "assigned_to_user_id" in data.model_dump(exclude_unset=True)
            and data.assigned_to_user_id != lead.assigned_to_user_id
        )
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(lead, field, value)

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=lead.branch_id, module="leads",
            action="reassigned" if reassigned else "updated", entity_type="lead", entity_id=str(lead.id),
        )
        await self.db.commit()
        await self.db.refresh(lead)
        return await self._to_read_model(lead)

    async def transition(
        self, lead_id: uuid.UUID, transition_key: str, actor_user_id: uuid.UUID, note: Optional[str] = None
    ) -> LeadRead:
        lead = await self.get_lead(lead_id)
        if not lead:
            raise LeadNotFoundError()

        instance = await self.workflow.get_instance_for_entity("lead", str(lead_id))
        if not instance:
            raise LeadNotFoundError("Lead has no workflow instance")

        await self.workflow.apply_transition(instance.id, transition_key, actor_user_id=actor_user_id, note=note)

        if transition_key == "convert":
            lead.is_converted = True
            lead.converted_at = datetime.now(timezone.utc)
            await self.db.commit()
            await self.db.refresh(lead)
            # NOTE: creating the actual Client record from a converted lead
            # is Phase 5 (Clients module) — that module will call this
            # service's read methods rather than Leads reaching into Clients.

        return await self._to_read_model(lead)
