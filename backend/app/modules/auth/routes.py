from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser, LoginRequest, RefreshRequest, TokenResponse
from app.modules.auth.service import AuthService, InvalidCredentialsError
from app.shared.rate_limit import enforce_rate_limit, login_rate_limit_key

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # 10 attempts per 5 minutes per (IP, email) pair — the classic
    # brute-force backstop. See app/shared/rate_limit.py for the
    # reasoning behind keying on both together.
    await enforce_rate_limit(login_rate_limit_key(request, payload.email), limit=10, window_seconds=300)

    service = AuthService(db)
    try:
        user = await service.authenticate(payload.email, payload.password)
    except InvalidCredentialsError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    return await service.issue_tokens(
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    try:
        return await service.refresh(payload.refresh_token)
    except InvalidCredentialsError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    await service.logout(payload.refresh_token)


@router.get("/me", response_model=CurrentUser)
async def me(current_user: CurrentUser = Depends(get_current_user)):
    return current_user
