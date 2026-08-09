from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.communications.schemas import CommunicationCreate, CommunicationRead
from app.modules.communications.service import CommunicationService, InvalidChannelError

router = APIRouter()


@router.get("/", response_model=list[CommunicationRead])
async def list_communications(
    entity_type: str,
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("communication.view")),
):
    return await CommunicationService(db).list_for_entity(entity_type, entity_id)


@router.post("/", response_model=CommunicationRead, status_code=status.HTTP_201_CREATED)
async def create_communication(
    payload: CommunicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("communication.send")),
):
    try:
        return await CommunicationService(db).create(payload, actor_user_id=current_user.id)
    except InvalidChannelError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "channel must be 'email' or 'internal_note'")
