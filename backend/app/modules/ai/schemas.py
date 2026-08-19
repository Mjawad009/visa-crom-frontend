import uuid
from typing import List, Literal, Optional

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None


class ChatResponse(BaseModel):
    content: str


class GenerateSOPRequest(BaseModel):
    client_id: uuid.UUID
    admission_id: Optional[uuid.UUID] = None
    additional_context: str = ""  # career goals, background, why this program


class GenerateCoverLetterRequest(BaseModel):
    client_id: uuid.UUID
    case_id: Optional[uuid.UUID] = None
    purpose: str = "visa application cover letter"
    additional_context: str = ""


class GeneratedTextResponse(BaseModel):
    content: str


class MissingDocumentsRequest(BaseModel):
    entity_type: str  # "case" | "admission"
    entity_id: str


class MissingDocumentsResponse(BaseModel):
    missing_categories: List[str]
    summary: str


class ClientSummaryRequest(BaseModel):
    client_id: uuid.UUID


class ClientSummaryResponse(BaseModel):
    summary: str


class VisaPathwayRequest(BaseModel):
    client_id: uuid.UUID
    destination_country: str
    purpose: str  # "study" | "work" | "visit" | "family" | "other"
    background_notes: str = ""


class VisaPathwayResponse(BaseModel):
    suggestions: str
    disclaimer: str = (
        "These are informational starting points only, not legal immigration "
        "advice. All pathway suggestions must be reviewed and confirmed by a "
        "licensed consultant before being shared with a client."
    )


class KnowledgeSearchRequest(BaseModel):
    query: str


class KnowledgeSource(BaseModel):
    type: str  # "document" | "communication"
    entity_type: str
    entity_id: str
    snippet: str


class KnowledgeSearchResponse(BaseModel):
    answer: str
    sources: List[KnowledgeSource]
