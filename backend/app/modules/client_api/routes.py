from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser
from app.modules.client_api.schemas import MyAdmission, MyCase, MyCommunication, MyDocument, MyProfile
from app.modules.client_api.service import ClientSelfService, NoLinkedClientError

router = APIRouter()

# Every route below requires client_portal.view_own, granted only to the
# "client" role (see permissions/seed.py). This module intentionally
# defines no POST/PATCH/DELETE routes at all — read-only by design, per
# the decision to expose an API for a future chatbot rather than build a
# full Client Portal UI.


@router.get("/profile", response_model=MyProfile)
async def my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("client_portal.view_own")),
):
    try:
        return await ClientSelfService(db).get_my_profile(current_user.id)
    except NoLinkedClientError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No client record is linked to this account yet")


@router.get("/cases", response_model=list[MyCase])
async def my_cases(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("client_portal.view_own")),
):
    try:
        return await ClientSelfService(db).get_my_cases(current_user.id)
    except NoLinkedClientError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No client record is linked to this account yet")


@router.get("/admissions", response_model=list[MyAdmission])
async def my_admissions(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("client_portal.view_own")),
):
    try:
        return await ClientSelfService(db).get_my_admissions(current_user.id)
    except NoLinkedClientError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No client record is linked to this account yet")


@router.get("/documents", response_model=list[MyDocument])
async def my_documents(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("client_portal.view_own")),
):
    try:
        return await ClientSelfService(db).get_my_documents(current_user.id)
    except NoLinkedClientError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No client record is linked to this account yet")


@router.get("/communications", response_model=list[MyCommunication])
async def my_communications(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("client_portal.view_own")),
):
    try:
        return await ClientSelfService(db).get_my_communications(current_user.id)
    except NoLinkedClientError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No client record is linked to this account yet")
