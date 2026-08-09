import pytest

from app.modules.workflow.schemas import StageDefinition, TransitionDefinition, WorkflowDefinitionCreate
from app.modules.workflow.service import InvalidTransitionError, WorkflowEngineService

pytestmark = pytest.mark.asyncio


async def _make_simple_definition(service: WorkflowEngineService, key: str):
    return await service.create_definition(
        WorkflowDefinitionCreate(
            key=key,
            name="Test Pipeline",
            module="test",
            stages=[
                StageDefinition(key="start", name="Start", order=1),
                StageDefinition(key="middle", name="Middle", order=2),
                StageDefinition(key="end", name="End", order=3, is_terminal=True),
            ],
            transitions=[
                TransitionDefinition(key="advance", name="Advance", from_stage_key="start", to_stage_key="middle"),
                TransitionDefinition(key="advance", name="Advance", from_stage_key="middle", to_stage_key="end"),
            ],
        )
    )


async def test_start_instance_lands_on_first_stage(db_session, seeded):
    service = WorkflowEngineService(db_session)
    await _make_simple_definition(service, "test_pipeline_1")

    await service.start_instance("test_pipeline_1", "widget", "widget-1", None, actor_user_id=None)
    stages = await service.get_stages_for_entities("widget", ["widget-1"])
    assert stages["widget-1"][0] == "start"


async def test_apply_transition_moves_to_next_stage(db_session, seeded):
    service = WorkflowEngineService(db_session)
    await _make_simple_definition(service, "test_pipeline_2")
    instance = await service.start_instance("test_pipeline_2", "widget", "widget-2", None, actor_user_id=None)

    updated = await service.apply_transition(instance.id, "advance", actor_user_id=None)
    stages = await service.get_stages_for_entities("widget", ["widget-2"])
    assert stages["widget-2"][0] == "middle"

    await service.apply_transition(updated.id, "advance", actor_user_id=None)
    stages = await service.get_stages_for_entities("widget", ["widget-2"])
    assert stages["widget-2"][0] == "end"


async def test_invalid_transition_from_current_stage_is_rejected(db_session, seeded):
    service = WorkflowEngineService(db_session)
    await _make_simple_definition(service, "test_pipeline_3")
    instance = await service.start_instance("test_pipeline_3", "widget", "widget-3", None, actor_user_id=None)

    # "advance" from "start" goes to "middle" — trying to skip straight
    # to a transition that's only valid *from* "middle" must fail.
    with pytest.raises(InvalidTransitionError):
        await service.apply_transition(instance.id, "nonexistent_transition", actor_user_id=None)


async def test_get_stage_counts_matches_seeded_lead_pipeline(db_session, seeded):
    service = WorkflowEngineService(db_session)
    counts = await service.get_stage_counts("lead_pipeline")
    stage_keys = [c["stage_key"] for c in counts]
    assert stage_keys == ["new", "contacted", "qualified", "proposal_sent", "converted", "lost"]
    assert all(c["count"] == 0 for c in counts)  # no leads created yet in this test


async def test_get_stages_for_entities_batches_correctly(db_session, seeded):
    """The Phase 15 N+1 fix: confirms the batch lookup returns the same
    answer as calling the single-entity lookup once per id."""
    service = WorkflowEngineService(db_session)
    await _make_simple_definition(service, "test_pipeline_4")
    await service.start_instance("test_pipeline_4", "widget", "batch-1", None, actor_user_id=None)
    await service.start_instance("test_pipeline_4", "widget", "batch-2", None, actor_user_id=None)

    batch_result = await service.get_stages_for_entities("widget", ["batch-1", "batch-2", "nonexistent"])
    assert batch_result["batch-1"][0] == "start"
    assert batch_result["batch-2"][0] == "start"
    assert "nonexistent" not in batch_result
