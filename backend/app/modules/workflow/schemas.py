import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class StageDefinition(BaseModel):
    key: str
    name: str
    order: int
    is_terminal: bool = False


class TransitionDefinition(BaseModel):
    key: str
    name: str
    from_stage_key: str
    to_stage_key: str
    required_permission: Optional[str] = None


class WorkflowDefinitionCreate(BaseModel):
    key: str
    name: str
    module: str
    stages: List[StageDefinition]
    transitions: List[TransitionDefinition]


class WorkflowStageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    key: str
    name: str
    order: int
    is_terminal: bool


class WorkflowDefinitionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    key: str
    name: str
    module: str
    is_active: bool
    stages: List[WorkflowStageRead] = []


class StartWorkflowRequest(BaseModel):
    definition_key: str
    entity_type: str
    entity_id: str
    branch_id: Optional[uuid.UUID] = None


class TransitionRequest(BaseModel):
    transition_key: str
    note: Optional[str] = None


class WorkflowInstanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    definition_id: uuid.UUID
    entity_type: str
    entity_id: str
    current_stage_id: uuid.UUID
