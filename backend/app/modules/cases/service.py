import random
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cases.models import Case
from app.modules.cases.schemas import CaseCreate, CaseRead, CaseUpdate
from app.modules.clients.public import get_active_client, get_client_display_name, get_client_display_names
from app.modules.workflow.models import WorkflowStage
from app.modules.workflow.service import WorkflowEngineService
from app.shared.activity import log_activity


class ClientNotEligibleError(Exception):
    """Raised when case creation references a client_id that doesn't
    exist or isn't active."""


class CaseNotFoundError(Exception):
    pass


async def _generate_unique_reference(db: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    for _ in range(10):
        candidate = f"VC-{year}-{random.randint(1000, 9999)}"
        existing = await db.execute(select(Case).where(Case.reference == candidate))
        if not existing.scalar_one_or_none():
            return candidate
    raise RuntimeError("Could not generate a unique case reference - try again")


class CaseService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.workflow = WorkflowEngineService(db)

    async def _to_read_model(
        self, case: Case, *, stage: Optional[tuple] = None, client_name: Optional[str] = None
    ) -> CaseRead:
        """`stage` and `client_name` can be pre-fetched (batch) by the
        caller — list_cases does this to avoid 2 queries per row. When
        omitted (single-record calls like get_case_read), falls back to
        the per-item lookups."""
        if stage is None:
            stage_key = stage_name = None
            instance = await self.workflow.get_instance_for_entity("case", str(case.id))
            if instance:
                stage_row = await self.db.get(WorkflowStage, instance.current_stage_id)
                if stage_row:
                    stage_key, stage_name = stage_row.key, stage_row.name
        else:
            stage_key, stage_name = stage

        if client_name is None:
            client_name = await get_client_display_name(self.db, case.client_id)

        data = CaseRead.model_validate(case)
        data.current_stage_key = stage_key
        data.current_stage_name = stage_name
        data.client_full_name = client_name
        return data

    async def list_cases(
        self,
        *,
        client_id: Optional[uuid.UUID] = None,
        branch_id: Optional[uuid.UUID] = None,
        restrict_to_consultant_id: Optional[uuid.UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[CaseRead]:
        stmt = select(Case).where(Case.deleted_at.is_(None)).order_by(Case.created_at.desc())
        if client_id:
            stmt = stmt.where(Case.client_id == client_id)
        if branch_id:
            stmt = stmt.where(Case.branch_id == branch_id)
        if restrict_to_consultant_id:
            stmt = stmt.where(Case.assigned_consultant_id == restrict_to_consultant_id)
        stmt = stmt.limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        cases = list(result.scalars().all())

        # Batch-fetch stage + client name for the whole page: 2 queries
        # total instead of 2 per row (was a real N+1 before Phase 15).
        stages = await self.workflow.get_stages_for_entities("case", [str(c.id) for c in cases])
        client_names = await get_client_display_names(self.db, [c.client_id for c in cases])

        return [
            await self._to_read_model(c, stage=stages.get(str(c.id)), client_name=client_names.get(c.client_id))
            for c in cases
        ]

    async def get_case(self, case_id: uuid.UUID) -> Optional[Case]:
        case = await self.db.get(Case, case_id)
        if not case or case.deleted_at is not None:
            return None
        return case

    async def get_case_read(self, case_id: uuid.UUID) -> Optional[CaseRead]:
        case = await self.get_case(case_id)
        return await self._to_read_model(case) if case else None

    async def create_case(self, data: CaseCreate, actor_user_id: uuid.UUID) -> CaseRead:
        client = await get_active_client(self.db, data.client_id)
        if not client:
            raise ClientNotEligibleError()

        reference = await _generate_unique_reference(self.db)
        payload = data.model_dump()
        if payload.get("branch_id") is None:
            payload["branch_id"] = client.branch_id
        if payload.get("assigned_consultant_id") is None:
            payload["assigned_consultant_id"] = client.assigned_consultant_id

        case = Case(reference=reference, **payload)
        self.db.add(case)
        await self.db.flush()

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=case.branch_id, module="cases",
            action="created", entity_type="case", entity_id=str(case.id),
            metadata={"reference": reference, "client_id": str(data.client_id)},
        )
        await self.db.commit()
        await self.db.refresh(case)

        await self.workflow.start_instance(
            "visa_case_pipeline", "case", str(case.id), case.branch_id, actor_user_id=actor_user_id
        )
        return await self._to_read_model(case)

    async def update_case(self, case_id: uuid.UUID, data: CaseUpdate, actor_user_id: uuid.UUID) -> Optional[CaseRead]:
        case = await self.get_case(case_id)
        if not case:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(case, field, value)

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=case.branch_id, module="cases",
            action="updated", entity_type="case", entity_id=str(case.id),
        )
        await self.db.commit()
        await self.db.refresh(case)
        return await self._to_read_model(case)

    async def transition(
        self, case_id: uuid.UUID, transition_key: str, actor_user_id: uuid.UUID, note: Optional[str] = None
    ) -> CaseRead:
        case = await self.get_case(case_id)
        if not case:
            raise CaseNotFoundError()

        instance = await self.workflow.get_instance_for_entity("case", str(case_id))
        if not instance:
            raise CaseNotFoundError("Case has no workflow instance")

        await self.workflow.apply_transition(instance.id, transition_key, actor_user_id=actor_user_id, note=note)

        if transition_key == "close_unsuccessful":
            case.is_closed = True
            case.closed_reason = "unsuccessful"
            await self.db.commit()
            await self.db.refresh(case)

        return await self._to_read_model(case)
