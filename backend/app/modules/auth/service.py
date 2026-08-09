from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.modules.auth.models import RefreshToken
from app.modules.auth.schemas import TokenResponse
from app.modules.permissions.models import Role
from app.modules.users.models import User
from app.shared.activity import log_activity


class InvalidCredentialsError(Exception):
    pass


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate(self, email: str, password: str) -> User:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not user.is_active or user.deleted_at is not None:
            raise InvalidCredentialsError()
        if not verify_password(password, user.hashed_password):
            raise InvalidCredentialsError()
        return user

    async def issue_tokens(self, user: User, user_agent: str | None = None, ip_address: str | None = None) -> TokenResponse:
        role = await self.db.get(Role, user.role_id)
        access_token = create_access_token(subject=str(user.id), extra_claims={"role": role.key})
        refresh_token, jti, expires_at = create_refresh_token(subject=str(user.id))

        self.db.add(
            RefreshToken(
                user_id=user.id,
                jti=jti,
                expires_at=expires_at,
                user_agent=user_agent,
                ip_address=ip_address,
            )
        )
        user.last_login_at = datetime.now(timezone.utc)

        await log_activity(
            self.db, actor_user_id=user.id, branch_id=user.branch_id,
            module="auth", action="login", entity_type="user", entity_id=str(user.id),
        )
        await self.db.commit()

        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            raise InvalidCredentialsError()

        if payload.get("type") != "refresh":
            raise InvalidCredentialsError()

        jti = payload.get("jti")
        result = await self.db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
        stored = result.scalar_one_or_none()
        if not stored or stored.revoked_at is not None or stored.expires_at < datetime.now(timezone.utc):
            raise InvalidCredentialsError()

        user = await self.db.get(User, stored.user_id)
        if not user or not user.is_active:
            raise InvalidCredentialsError()

        # Rotate: revoke the old refresh token, issue a brand new pair.
        stored.revoked_at = datetime.now(timezone.utc)
        await self.db.commit()

        return await self.issue_tokens(user, user_agent=stored.user_agent, ip_address=stored.ip_address)

    async def logout(self, refresh_token: str) -> None:
        try:
            payload = decode_token(refresh_token)
        except ValueError:
            return
        jti = payload.get("jti")
        result = await self.db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
        stored = result.scalar_one_or_none()
        if stored:
            stored.revoked_at = datetime.now(timezone.utc)
            await self.db.commit()
