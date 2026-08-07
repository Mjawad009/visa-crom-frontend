"""Seeds the admissions pipeline workflow definition. Idempotent."""
from app.modules.workflow.schemas import StageDefinition, TransitionDefinition, WorkflowDefinitionCreate
from app.modules.workflow.service import WorkflowEngineService

STAGE_KEYS = [
    "preparing_application",
    "submitted_to_institution",
    "offer_received",
    "deposit_paid",
    "document_issued",  # CAS / I-20 / equivalent issued
    "completed",
]
TERMINAL_UNSUCCESSFUL = "closed_unsuccessful"  # rejected by institution / withdrawn


async def seed_admissions_pipeline(db) -> None:
    service = WorkflowEngineService(db)
    existing = await service.get_definition_by_key("admissions_pipeline")
    if existing:
        return

    stages = [
        StageDefinition(key=key, name=key.replace("_", " ").title(), order=i + 1, is_terminal=(key == "completed"))
        for i, key in enumerate(STAGE_KEYS)
    ]
    stages.append(
        StageDefinition(key=TERMINAL_UNSUCCESSFUL, name="Closed — Unsuccessful", order=len(STAGE_KEYS) + 1, is_terminal=True)
    )

    transitions = []
    for i in range(len(STAGE_KEYS) - 1):
        transitions.append(
            TransitionDefinition(key="advance", name="Advance to next stage", from_stage_key=STAGE_KEYS[i], to_stage_key=STAGE_KEYS[i + 1])
        )
    for key in STAGE_KEYS[:-1]:
        transitions.append(
            TransitionDefinition(key="close_unsuccessful", name="Close — Unsuccessful", from_stage_key=key, to_stage_key=TERMINAL_UNSUCCESSFUL)
        )

    await service.create_definition(
        WorkflowDefinitionCreate(key="admissions_pipeline", name="Admissions Pipeline", module="admissions", stages=stages, transitions=transitions)
    )
