import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.clients.schemas import ClientCreate, ClientRead, ClientUpdate
from app.modules.clients.service import ClientService, LeadNotConvertibleError

router = APIRouter()


@router.get("/", response_model=list[ClientRead])
async def list_clients(
    branch_id: Optional[uuid.UUID] = None,
    include_inactive: bool = False,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if "clients.view" not in current_user.permissions and not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing required permission: clients.view")

    restrict_to = None
    if "clients.view_all" not in current_user.permissions and not current_user.is_superuser:
        restrict_to = current_user.id

    limit = min(limit, 200)
    return await ClientService(db).list_clients(
        branch_id=branch_id, restrict_to_consultant_id=restrict_to, include_inactive=include_inactive,
        limit=limit, offset=offset,
    )


@router.get("/{client_id}", response_model=ClientRead)
async def get_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    client = await ClientService(db).get_client(client_id)
    if not client:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")

    can_view_all = "clients.view_all" in current_user.permissions or current_user.is_superuser
    if not can_view_all and client.assigned_consultant_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this client")

    return client


@router.post("/", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("clients.create")),
):
    try:
        return await ClientService(db).create_client(payload, actor_user_id=current_user.id)
    except LeadNotConvertibleError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This lead does not exist or has not reached the 'converted' stage yet",
        )


@router.patch("/{client_id}", response_model=ClientRead)
async def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("clients.update")),
):
    if payload.is_active is False and "clients.deactivate" not in current_user.permissions and not current_user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing required permission: clients.deactivate")

    client = await ClientService(db).update_client(client_id, payload, actor_user_id=current_user.id)
    if not client:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    return client
