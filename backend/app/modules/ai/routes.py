import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.admissions.public import get_admission_summary
from app.modules.ai.schemas import (
    ChatRequest,
    ChatResponse,
    ClientSummaryRequest,
    ClientSummaryResponse,
    GenerateCoverLetterRequest,
    GenerateSOPRequest,
    GeneratedTextResponse,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeSource,
    MissingDocumentsRequest,
    MissingDocumentsResponse,
    VisaPathwayRequest,
    VisaPathwayResponse,
)
from app.modules.auth.schemas import CurrentUser
from app.modules.cases.public import get_case_summary
from app.modules.clients.public import get_client_ai_context
from app.modules.communications.service import CommunicationService
from app.modules.files.service import FileService
from app.shared.activity import log_activity
from app.shared.ai_service import AIServiceError, chat

router = APIRouter()


def _assert_owner_or_view_all(current_user: CurrentUser, view_all_permission: str, owner_id) -> None:
    if current_user.is_superuser:
        return
    if view_all_permission in current_user.permissions:
        return
    if owner_id is not None and str(owner_id) == str(current_user.id):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this record")


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("ai.use_assistant")),
):
    try:
        content = await chat([m.model_dump() for m in payload.messages], model=payload.model)
    except AIServiceError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    await log_activity(
        db, actor_user_id=current_user.id, branch_id=current_user.branch_id,
        module="ai", action="chat_completion", entity_type="ai_chat", entity_id=str(current_user.id),
    )
    await db.commit()
    return ChatResponse(content=content)


@router.post("/generate-sop", response_model=GeneratedTextResponse)
async def generate_sop(
    payload: GenerateSOPRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("ai.use_assistant")),
):
    client = await get_client_ai_context(db, payload.client_id)
    if not client:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    _assert_owner_or_view_all(current_user, "clients.view_all", client.assigned_consultant_id)

    admission_context = ""
    if payload.admission_id:
        admission = await get_admission_summary(db, payload.admission_id)
        if admission and admission.client_id == client.id:
            admission_context = (
                f"Institution: {admission.institution_name}\n"
                f"Program: {admission.program_name or 'unspecified'}\n"
                f"Intake: {admission.intake_term or 'unspecified'}\n"
            )

    prompt = (
        f"Draft a Statement of Purpose for a study-visa applicant.\n\n"
        f"Applicant name: {client.full_name}\n"
        f"Nationality: {client.nationality or 'unspecified'}\n"
        f"{admission_context}\n"
        f"Additional context from the applicant/consultant:\n{payload.additional_context}\n\n"
        f"Write a well-structured, first-person draft SOP (400-600 words). "
        f"This is a first draft for the consultant to review and edit with the client, not a final document."
    )
    try:
        content = await chat([{"role": "user", "content": prompt}], temperature=0.5, max_tokens=1200)
    except AIServiceError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    await log_activity(
        db, actor_user_id=current_user.id, branch_id=client.branch_id, module="ai",
        action="sop_generated", entity_type="client", entity_id=str(client.id),
    )
    await db.commit()
    return GeneratedTextResponse(content=content)


@router.post("/generate-cover-letter", response_model=GeneratedTextResponse)
async def generate_cover_letter(
    payload: GenerateCoverLetterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("ai.use_assistant")),
):
    client = await get_client_ai_context(db, payload.client_id)
    if not client:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    _assert_owner_or_view_all(current_user, "clients.view_all", client.assigned_consultant_id)

    case_context = ""
    if payload.case_id:
        case = await get_case_summary(db, payload.case_id)
        if case and case.client_id == client.id:
            case_context = (
                f"Case type: {case.case_type}\n"
                f"Destination: {case.destination_country or 'unspecified'}\n"
                f"Visa type: {case.visa_type or 'unspecified'}\n"
            )

    prompt = (
        f"Draft a {payload.purpose} for a visa consultancy client.\n\n"
        f"Client name: {client.full_name}\n"
        f"Nationality: {client.nationality or 'unspecified'}\n"
        f"{case_context}\n"
        f"Additional context:\n{payload.additional_context}\n\n"
        f"Write a professional, formal-register draft letter (250-400 words). "
        f"This is a first draft for staff review, not a final document."
    )
    try:
        content = await chat([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=900)
    except AIServiceError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    await log_activity(
        db, actor_user_id=current_user.id, branch_id=client.branch_id, module="ai",
        action="cover_letter_generated", entity_type="client", entity_id=str(client.id),
    )
    await db.commit()
    return GeneratedTextResponse(content=content)


@router.post("/missing-documents", response_model=MissingDocumentsResponse)
async def missing_documents(
    payload: MissingDocumentsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("ai.use_assistant")),
):
    if payload.entity_type not in ("case", "admission"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "entity_type must be 'case' or 'admission'")

    file_service = FileService(db)
    categories = await file_service.list_categories()
    required_keys = {c.key for c in categories if c.expiry_tracking_enabled}

    files = await file_service.list_for_entity(payload.entity_type, payload.entity_id)
    covered_keys = {f.category for f in files if f.status in ("verified", "pending") and f.category}

    missing = sorted(required_keys - covered_keys)

    if not missing:
        summary = "All commonly-required identity/verification documents are present."
    else:
        category_names = ", ".join(missing)
        prompt = (
            f"A visa consultancy client is missing these document categories: {category_names}. "
            f"Write a short (2-3 sentence), client-facing note explaining what's still needed, in a warm, clear tone."
        )
        try:
            summary = await chat([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=200)
        except AIServiceError:
            summary = f"Missing document categories: {category_names}."

    return MissingDocumentsResponse(missing_categories=missing, summary=summary)


@router.post("/client-summary", response_model=ClientSummaryResponse)
async def client_summary(
    payload: ClientSummaryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("ai.use_assistant")),
):
    client = await get_client_ai_context(db, payload.client_id)
    if not client:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    _assert_owner_or_view_all(current_user, "clients.view_all", client.assigned_consultant_id)

    comms = await CommunicationService(db).list_for_entity("client", str(client.id))
    recent_notes = "\n".join(f"- {c.body[:200]}" for c in comms[:5]) or "No communication history yet."

    prompt = (
        f"Summarize this client's current status for a colleague picking up the file.\n\n"
        f"Client: {client.full_name} ({client.nationality or 'nationality unspecified'})\n"
        f"Recent communication history:\n{recent_notes}\n\n"
        f"Write a concise (3-5 sentence) internal summary."
    )
    try:
        summary = await chat([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=400)
    except AIServiceError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    return ClientSummaryResponse(summary=summary)


@router.post("/visa-pathway-suggestions", response_model=VisaPathwayResponse)
async def visa_pathway_suggestions(
    payload: VisaPathwayRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("ai.use_assistant")),
):
    client = await get_client_ai_context(db, payload.client_id)
    if not client:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    _assert_owner_or_view_all(current_user, "clients.view_all", client.assigned_consultant_id)

    prompt = (
        f"A visa consultant is exploring options for a client.\n\n"
        f"Client nationality: {client.nationality or 'unspecified'}\n"
        f"Destination of interest: {payload.destination_country}\n"
        f"Purpose: {payload.purpose}\n"
        f"Background: {payload.background_notes or 'none provided'}\n\n"
        f"List 2-4 plausible visa pathway categories worth investigating further, with one line each on "
        f"why it might fit. Be clear these are starting points for research, not conclusions."
    )
    try:
        suggestions = await chat([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=600)
    except AIServiceError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    return VisaPathwayResponse(suggestions=suggestions)


@router.post("/knowledge-search", response_model=KnowledgeSearchResponse)
async def knowledge_search(
    payload: KnowledgeSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("ai.use_assistant")),
):
    """Known simplification: searches Files (OCR text/filename/category)
    and Communications (body/subject) via the same pragmatic ILIKE
    approach as Phase 7's document search — not a Meilisearch-backed
    semantic index. Good enough to answer "have we seen anything about
    X" without standing up a search cluster for this build."""
    files = await FileService(db).search(payload.query)
    comms = await CommunicationService(db).search(payload.query)

    sources = [
        KnowledgeSource(type="document", entity_type=f.entity_type, entity_id=f.entity_id, snippet=(f.ocr_text or f.filename)[:300])
        for f in files[:5]
    ] + [
        KnowledgeSource(type="communication", entity_type=c.entity_type, entity_id=c.entity_id, snippet=c.body[:300])
        for c in comms[:5]
    ]

    if not sources:
        return KnowledgeSearchResponse(answer="No matching internal records were found for that query.", sources=[])

    context = "\n---\n".join(f"[{s.type}] {s.snippet}" for s in sources)
    prompt = (
        f"Answer the question using only the internal records below. If the records don't answer it, say so.\n\n"
        f"Question: {payload.query}\n\nRecords:\n{context}"
    )
    try:
        answer = await chat([{"role": "user", "content": prompt}], temperature=0.2, max_tokens=500)
    except AIServiceError:
        answer = "Found matching records, but could not generate a synthesized answer right now."

    return KnowledgeSearchResponse(answer=answer, sources=sources)
