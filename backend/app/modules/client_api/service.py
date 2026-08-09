"""
Client Self-Service API - Business Module (Phase 14).

Deliberately GET-only. No create/update/delete anywhere in this module
- per the decision to skip a full Client Portal UI, this exists purely
so a future chatbot (or any other read-only client) can fetch a client's
own status. Every method here starts from "which client record does
this authenticated user map to" and reads only through other modules'
public interfaces - it never queries Lead/Case/AdmissionApplication
tables directly, same discipline as Reports (Phase 13).
"""
import uuid
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admissions.public import get_admission_summaries_for_client
from app.modules.cases.public import get_case_summaries_for_client
from app.modules.client_api.schemas import MyAdmission, MyCase, MyCommunication, MyDocument, MyProfile
from app.modules.clients.public import get_client_id_for_user, get_own_profile
from app.modules.communications.service import CommunicationService
from app.modules.files.service import FileService
from app.modules.workflow.models import WorkflowStage
from app.modules.workflow.service import WorkflowEngineService


class NoLinkedClientError(Exception):
    """Raised when the authenticated user has no client record linked to
    it - most 'client' role users won't, until staff link one."""


class ClientSelfService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.workflow = WorkflowEngineService(db)

    async def _resolve_client_id(self, user_id: uuid.UUID) -> uuid.UUID:
        client_id = await get_client_id_for_user(self.db, user_id)
        if not client_id:
            raise NoLinkedClientError()
        return client_id

    async def _stage_for(self, entity_type: str, entity_id: str) -> tuple[Optional[str], Optional[str]]:
        instance = await self.workflow.get_instance_for_entity(entity_type, entity_id)
        if not instance:
            return None, None
        stage = await self.db.get(WorkflowStage, instance.current_stage_id)
        return (stage.key, stage.name) if stage else (None, None)

    async def get_my_profile(self, user_id: uuid.UUID) -> MyProfile:
        client_id = await self._resolve_client_id(user_id)
        profile = await get_own_profile(self.db, client_id)
        if not profile:
            raise NoLinkedClientError()
        return MyProfile(**profile.model_dump())

    async def get_my_cases(self, user_id: uuid.UUID) -> List[MyCase]:
        client_id = await self._resolve_client_id(user_id)
        cases = await get_case_summaries_for_client(self.db, client_id)
        results = []
        for case in cases:
            stage_key, stage_name = await self._stage_for("case", str(case.id))
            results.append(
                MyCase(
                    id=case.id, case_type=case.case_type, destination_country=case.destination_country,
                    visa_type=case.visa_type, current_stage_key=stage_key, current_stage_name=stage_name,
                )
            )
        return results

    async def get_my_admissions(self, user_id: uuid.UUID) -> List[MyAdmission]:
        client_id = await self._resolve_client_id(user_id)
        admissions = await get_admission_summaries_for_client(self.db, client_id)
        results = []
        for app in admissions:
            stage_key, stage_name = await self._stage_for("admission", str(app.id))
            results.append(
                MyAdmission(
                    id=app.id, institution_name=app.institution_name, program_name=app.program_name,
                    country=app.country, intake_term=app.intake_term,
                    current_stage_key=stage_key, current_stage_name=stage_name,
                )
            )
        return results

    async def get_my_documents(self, user_id: uuid.UUID) -> List[MyDocument]:
        client_id = await self._resolve_client_id(user_id)
        file_service = FileService(self.db)

        # A client's documents can be attached to their client record, any
        # of their cases, or any of their admission applications.
        entity_refs = [("client", str(client_id))]
        for case in await get_case_summaries_for_client(self.db, client_id):
            entity_refs.append(("case", str(case.id)))
        for app in await get_admission_summaries_for_client(self.db, client_id):
            entity_refs.append(("admission", str(app.id)))

        documents: List[MyDocument] = []
        for entity_type, entity_id in entity_refs:
            files = await file_service.list_for_entity(entity_type, entity_id)
            for f in files:
                if f.status == "superseded":
                    continue  # clients see current versions only, not history
                documents.append(
                    MyDocument(
                        id=f.id, entity_type=entity_type, entity_id=entity_id, category=f.category,
                        filename=f.filename, status=f.status,
                        expiry_date=f.expiry_date.isoformat() if f.expiry_date else None,
                        created_at=f.created_at,
                    )
                )
        return documents

    async def get_my_communications(self, user_id: uuid.UUID) -> List[MyCommunication]:
        """Only outbound emails actually sent to the client - internal
        notes never surface here, enforced by filtering on channel."""
        client_id = await self._resolve_client_id(user_id)
        comm_service = CommunicationService(self.db)

        entity_refs = [("client", str(client_id))]
        for case in await get_case_summaries_for_client(self.db, client_id):
            entity_refs.append(("case", str(case.id)))
        for app in await get_admission_summaries_for_client(self.db, client_id):
            entity_refs.append(("admission", str(app.id)))

        results: List[MyCommunication] = []
        for entity_type, entity_id in entity_refs:
            logs = await comm_service.list_for_entity(entity_type, entity_id)
            for log in logs:
                if log.channel != "email":
                    continue
                results.append(
                    MyCommunication(
                        id=log.id, entity_type=entity_type, entity_id=entity_id,
                        subject=log.subject, body=log.body, created_at=log.created_at,
                    )
                )
        results.sort(key=lambda c: c.created_at, reverse=True)
        return results
