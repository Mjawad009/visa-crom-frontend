"""Seeds the lead pipeline workflow definition. Run as part of scripts/seed.py.
Idempotent: skips if 'lead_pipeline' already exists."""
from app.modules.workflow.schemas import StageDefinition, TransitionDefinition, WorkflowDefinitionCreate
from app.modules.workflow.service import WorkflowEngineService


async def seed_lead_pipeline(db) -> None:
    service = WorkflowEngineService(db)
    existing = await service.get_definition_by_key("lead_pipeline")
    if existing:
        return

    stages = [
        StageDefinition(key="new", name="New", order=1),
        StageDefinition(key="contacted", name="Contacted", order=2),
        StageDefinition(key="qualified", name="Qualified", order=3),
        StageDefinition(key="proposal_sent", name="Proposal Sent", order=4),
        StageDefinition(key="converted", name="Converted", order=5, is_terminal=True),
        StageDefinition(key="lost", name="Lost", order=6, is_terminal=True),
    ]
    transitions = [
        TransitionDefinition(key="contact", name="Mark Contacted", from_stage_key="new", to_stage_key="contacted"),
        TransitionDefinition(key="qualify", name="Qualify", from_stage_key="contacted", to_stage_key="qualified"),
        TransitionDefinition(key="send_proposal", name="Send Proposal", from_stage_key="qualified", to_stage_key="proposal_sent"),
        TransitionDefinition(key="convert", name="Convert", from_stage_key="proposal_sent", to_stage_key="converted"),
        # A lead can be marked lost from any active stage. Transition keys
        # are scoped by (from_stage, key), so reusing "mark_lost" across
        # rows is fine — the engine looks up by current stage first.
        TransitionDefinition(key="mark_lost", name="Mark Lost", from_stage_key="new", to_stage_key="lost"),
        TransitionDefinition(key="mark_lost", name="Mark Lost", from_stage_key="contacted", to_stage_key="lost"),
        TransitionDefinition(key="mark_lost", name="Mark Lost", from_stage_key="qualified", to_stage_key="lost"),
        TransitionDefinition(key="mark_lost", name="Mark Lost", from_stage_key="proposal_sent", to_stage_key="lost"),
    ]

    await service.create_definition(
        WorkflowDefinitionCreate(key="lead_pipeline", name="Lead Pipeline", module="leads", stages=stages, transitions=transitions)
    )
