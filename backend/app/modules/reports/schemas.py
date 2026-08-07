from typing import Dict, List

from pydantic import BaseModel


class FunnelStage(BaseModel):
    stage_key: str
    stage_name: str
    count: int


class FunnelResponse(BaseModel):
    definition_key: str
    stages: List[FunnelStage]


class BranchPerformanceRow(BaseModel):
    branch_id: str
    branch_name: str
    leads: int
    clients: int
    cases: int
    admissions: int


class BranchPerformanceResponse(BaseModel):
    rows: List[BranchPerformanceRow]


class DocumentComplianceResponse(BaseModel):
    status_counts: Dict[str, int]
    expiring_within_30_days: int
