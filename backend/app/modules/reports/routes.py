from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.reports.schemas import BranchPerformanceResponse, DocumentComplianceResponse, FunnelResponse
from app.modules.reports.service import ReportsService

router = APIRouter()


@router.get("/funnel/leads", response_model=FunnelResponse)
async def lead_funnel(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports.view")),
):
    return await ReportsService(db).lead_funnel()


@router.get("/funnel/cases", response_model=FunnelResponse)
async def case_funnel(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports.view")),
):
    return await ReportsService(db).case_funnel()


@router.get("/funnel/admissions", response_model=FunnelResponse)
async def admissions_funnel(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports.view")),
):
    return await ReportsService(db).admissions_funnel()


@router.get("/branch-performance", response_model=BranchPerformanceResponse)
async def branch_performance(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports.view")),
):
    return await ReportsService(db).branch_performance()


@router.get("/document-compliance", response_model=DocumentComplianceResponse)
async def document_compliance(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports.view")),
):
    return await ReportsService(db).document_compliance()
