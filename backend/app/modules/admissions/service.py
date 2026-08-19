import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admissions.models import AdmissionApplication
from app.modules.admissions.schemas import AdmissionApplicationCreate, AdmissionApplicationRead, AdmissionApplicationUpdate
from app.modules.clients.public import get_active_client, get_client_display_name, get_client_display_names
from app.modules.workflow.models import WorkflowStage
from app.modules.workflow.service import WorkflowEngineService
from app.shared.activity import log_activity


class ClientNotEligibleError(Exception):
    pass


class AdmissionNotFoundError(Exception):
    pass


class AdmissionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.workflow = WorkflowEngineService(db)

    async def _to_read_model(
        self, app: AdmissionApplication, *, stage: Optional[tuple] = None, client_name: Optional[str] = None
    ) -> AdmissionApplicationRead:
        if stage is None:
            stage_key = stage_name = None
            instance = await self.workflow.get_instance_for_entity("admission", str(app.id))
            if instance:
                stage_row = await self.db.get(WorkflowStage, instance.current_stage_id)
                if stage_row:
                    stage_key, stage_name = stage_row.key, stage_row.name
        else:
            stage_key, stage_name = stage

        if client_name is None:
            client_name = await get_client_display_name(self.db, app.client_id)

        data = AdmissionApplicationRead.model_validate(app)
        data.current_stage_key = stage_key
        data.current_stage_name = stage_name
        data.client_full_name = client_name
        return data

    async def list_applications(
        self,
        *,
        client_id: Optional[uuid.UUID] = None,
        branch_id: Optional[uuid.UUID] = None,
        restrict_to_officer_id: Optional[uuid.UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AdmissionApplicationRead]:
        stmt = select(AdmissionApplication).where(AdmissionApplication.deleted_at.is_(None)).order_by(
            AdmissionApplication.created_at.desc()
        )
        if client_id:
            stmt = stmt.where(AdmissionApplication.client_id == client_id)
        if branch_id:
            stmt = stmt.where(AdmissionApplication.branch_id == branch_id)
        if restrict_to_officer_id:
            stmt = stmt.where(AdmissionApplication.assigned_officer_id == restrict_to_officer_id)
        stmt = stmt.limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        apps = list(result.scalars().all())

        # Batch-fetch stage + client name for the whole page (was a real
        # N+1 before Phase 15 — same fix applied to Leads and Cases).
        stages = await self.workflow.get_stages_for_entities("admission", [str(a.id) for a in apps])
        client_names = await get_client_display_names(self.db, [a.client_id for a in apps])

        return [
            await self._to_read_model(a, stage=stages.get(str(a.id)), client_name=client_names.get(a.client_id))
            for a in apps
        ]

    async def get_application(self, app_id: uuid.UUID) -> Optional[AdmissionApplication]:
        app = await self.db.get(AdmissionApplication, app_id)
        if not app or app.deleted_at is not None:
            return None
        return app

    async def get_application_read(self, app_id: uuid.UUID) -> Optional[AdmissionApplicationRead]:
        app = await self.get_application(app_id)
        return await self._to_read_model(app) if app else None

    async def create_application(self, data: AdmissionApplicationCreate, actor_user_id: uuid.UUID) -> AdmissionApplicationRead:
        client = await get_active_client(self.db, data.client_id)
        if not client:
            raise ClientNotEligibleError()

        payload = data.model_dump()
        if payload.get("branch_id") is None:
            payload["branch_id"] = client.branch_id
        if payload.get("assigned_officer_id") is None:
            payload["assigned_officer_id"] = client.assigned_consultant_id

        app = AdmissionApplication(**payload)
        self.db.add(app)
        await self.db.flush()

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=app.branch_id, module="admissions",
            action="created", entity_type="admission", entity_id=str(app.id),
            metadata={"institution": app.institution_name, "client_id": str(data.client_id)},
        )
        await self.db.commit()
        await self.db.refresh(app)

        await self.workflow.start_instance(
            "admissions_pipeline", "admission", str(app.id), app.branch_id, actor_user_id=actor_user_id
        )
        return await self._to_read_model(app)

    async def update_application(
        self, app_id: uuid.UUID, data: AdmissionApplicationUpdate, actor_user_id: uuid.UUID
    ) -> Optional[AdmissionApplicationRead]:
        app = await self.get_application(app_id)
        if not app:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(app, field, value)

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=app.branch_id, module="admissions",
            action="updated", entity_type="admission", entity_id=str(app.id),
        )
        await self.db.commit()
        await self.db.refresh(app)
        return await self._to_read_model(app)

    async def transition(
        self, app_id: uuid.UUID, transition_key: str, actor_user_id: uuid.UUID, note: Optional[str] = None
    ) -> AdmissionApplicationRead:
        app = await self.get_application(app_id)
        if not app:
            raise AdmissionNotFoundError()

        instance = await self.workflow.get_instance_for_entity("admission", str(app_id))
        if not instance:
            raise AdmissionNotFoundError("Application has no workflow instance")

        await self.workflow.apply_transition(instance.id, transition_key, actor_user_id=actor_user_id, note=note)

        if transition_key == "close_unsuccessful":
            app.is_closed = True
            app.closed_reason = "unsuccessful"
            await self.db.commit()
            await self.db.refresh(app)
        elif transition_key == "reopen":
            app.is_closed = False
            app.closed_reason = None
            await self.db.commit()
            await self.db.refresh(app)
        else:
            refreshed = await self.workflow.get_instance_for_entity("admission", str(app_id))
            new_stage = await self.db.get(WorkflowStage, refreshed.current_stage_id) if refreshed else None
            if new_stage and new_stage.is_terminal and new_stage.key != "closed_unsuccessful":
                app.is_closed = True
                app.closed_reason = "successful"
                await self.db.commit()
                await self.db.refresh(app)

        return await self._to_read_model(app)
