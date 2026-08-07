"""
Reports & Analytics - Business Module (Phase 13).

Deliberately touches no other module's models directly. Funnel reports
use the generic Workflow Engine aggregation added this phase
(app/modules/workflow/service.py: get_stage_counts). Branch/document
reports use the narrow, count-only functions added to each module's
public.py this phase - Reports never sees a lead's name, a client's
passport number, or a case's notes, only numbers grouped by branch.
"""
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admissions.public import get_admission_counts_by_branch
from app.modules.branches.models import Branch
from app.modules.cases.public import get_case_counts_by_branch, get_case_counts_by_consultant
from app.modules.clients.public import get_client_counts_by_branch
from app.modules.files.service import FileService
from app.modules.leads.public import get_lead_counts_by_branch
from app.modules.reports.schemas import (
    BranchPerformanceResponse,
    BranchPerformanceRow,
    DocumentComplianceResponse,
    FunnelResponse,
)
from app.modules.workflow.service import WorkflowEngineService


class ReportsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def lead_funnel(self) -> FunnelResponse:
        stages = await WorkflowEngineService(self.db).get_stage_counts("lead_pipeline")
        return FunnelResponse(definition_key="lead_pipeline", stages=stages)

    async def case_funnel(self) -> FunnelResponse:
        stages = await WorkflowEngineService(self.db).get_stage_counts("visa_case_pipeline")
        return FunnelResponse(definition_key="visa_case_pipeline", stages=stages)

    async def admissions_funnel(self) -> FunnelResponse:
        stages = await WorkflowEngineService(self.db).get_stage_counts("admissions_pipeline")
        return FunnelResponse(definition_key="admissions_pipeline", stages=stages)

    async def branch_performance(self) -> BranchPerformanceResponse:
        branches_result = await self.db.execute(select(Branch).where(Branch.is_active.is_(True)))
        branches = list(branches_result.scalars().all())

        leads_by_branch = await get_lead_counts_by_branch(self.db)
        clients_by_branch = await get_client_counts_by_branch(self.db)
        cases_by_branch = await get_case_counts_by_branch(self.db)
        admissions_by_branch = await get_admission_counts_by_branch(self.db)

        rows: List[BranchPerformanceRow] = []
        for branch in branches:
            key = str(branch.id)
            rows.append(
                BranchPerformanceRow(
                    branch_id=key,
                    branch_name=branch.name,
                    leads=leads_by_branch.get(key, 0),
                    clients=clients_by_branch.get(key, 0),
                    cases=cases_by_branch.get(key, 0),
                    admissions=admissions_by_branch.get(key, 0),
                )
            )

        unassigned_total = sum(
            d.get("unassigned", 0) for d in (leads_by_branch, clients_by_branch, cases_by_branch, admissions_by_branch)
        )
        if unassigned_total:
            rows.append(
                BranchPerformanceRow(
                    branch_id="unassigned",
                    branch_name="Unassigned",
                    leads=leads_by_branch.get("unassigned", 0),
                    clients=clients_by_branch.get("unassigned", 0),
                    cases=cases_by_branch.get("unassigned", 0),
                    admissions=admissions_by_branch.get("unassigned", 0),
                )
            )

        return BranchPerformanceResponse(rows=rows)

    async def staff_case_workload(self) -> dict:
        """Consultant user id -> open case count. Caller resolves names
        via the Users module if it wants to display them."""
        return await get_case_counts_by_consultant(self.db)

    async def document_compliance(self) -> DocumentComplianceResponse:
        file_service = FileService(self.db)
        status_counts = await file_service.get_status_counts()
        expiring = await file_service.list_expiring(within_days=30)
        return DocumentComplianceResponse(status_counts=status_counts, expiring_within_30_days=len(expiring))
