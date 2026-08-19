"""Seeds the visa case pipeline workflow definition. Idempotent."""
from app.modules.workflow.schemas import StageDefinition, TransitionDefinition, WorkflowDefinitionCreate
from app.modules.workflow.service import WorkflowEngineService

# Order matches the master spec exactly.
STAGE_KEYS = [
    "consultation",
    "document_collection",
    "eligibility_review",
    "application",
    "submission",
    "biometrics",
    "medical",
    "interview",
    "decision",
    "post_visa_support",  # terminal: case approved, ongoing support
]
TERMINAL_UNSUCCESSFUL = "closed_unsuccessful"  # terminal: refused / withdrawn, reachable from any active stage


async def seed_case_pipeline(db) -> None:
    service = WorkflowEngineService(db)

    transitions = []
    # Linear "advance" between every consecutive pair of stages, one shared
    # key reused across rows — same pattern as leads/seed.py.
    for i in range(len(STAGE_KEYS) - 1):
        transitions.append(
            TransitionDefinition(key="advance", name="Advance to next stage", from_stage_key=STAGE_KEYS[i], to_stage_key=STAGE_KEYS[i + 1])
        )
    # A case can be closed unsuccessfully from any active (non-terminal) stage.
    for key in STAGE_KEYS[:-1]:
        transitions.append(
            TransitionDefinition(key="close_unsuccessful", name="Close — Unsuccessful", from_stage_key=key, to_stage_key=TERMINAL_UNSUCCESSFUL)
        )
    # Reopen a case closed unsuccessfully by mistake — drops it back to
    # the very first stage; the consultant re-advances it manually from there.
    transitions.append(
        TransitionDefinition(key="reopen", name="Reopen", from_stage_key=TERMINAL_UNSUCCESSFUL, to_stage_key=STAGE_KEYS[0])
    )

    existing = await service.get_definition_by_key("visa_case_pipeline")
    if existing:
        await service.sync_transitions("visa_case_pipeline", transitions)
        return

    stages = [
        StageDefinition(key=key, name=key.replace("_", " ").title(), order=i + 1, is_terminal=(key == "post_visa_support"))
        for i, key in enumerate(STAGE_KEYS)
    ]
    stages.append(
        StageDefinition(key=TERMINAL_UNSUCCESSFUL, name="Closed — Unsuccessful", order=len(STAGE_KEYS) + 1, is_terminal=True)
    )

    await service.create_definition(
        WorkflowDefinitionCreate(key="visa_case_pipeline", name="Visa Case Pipeline", module="cases", stages=stages, transitions=transitions)
    )
