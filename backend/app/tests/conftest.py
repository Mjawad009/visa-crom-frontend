"""
Shared test fixtures.

These tests require a real, reachable Postgres (DATABASE_URL) and Redis
(REDIS_URL) - this sandbox has neither, so they're written to be green
the moment a dev database is available (`docker compose up`, then
`pytest`), not run here. External services with no place in a test run
(Cloudflare R2, Tesseract OCR, OpenRouter, Resend) are mocked at the
shared/ seam - the same seam that makes each of them swappable in
production is what makes them mockable in tests.

Isolation strategy: each test runs inside a savepoint that's rolled back
afterward, so tests never see each other's data and the schema only
needs to be created once per test session.
"""
import asyncio
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.db import models_registry  # noqa: F401 -- registers all models on Base.metadata
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.modules.branches.models import Branch
from app.modules.cases.seed import seed_case_pipeline
from app.modules.admissions.seed import seed_admissions_pipeline
from app.modules.files.seed import seed_document_categories
from app.modules.leads.seed import seed_lead_pipeline
from app.modules.permissions.models import Role
from app.modules.permissions.seed import seed_permissions
from app.modules.users.models import User

settings = get_settings()


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(settings.DATABASE_URL)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    """One savepoint per test - rolled back at teardown regardless of
    whether the test committed, so tests are fully isolated from each
    other without recreating the schema every time."""
    connection = await engine.connect()
    transaction = await connection.begin()
    session_factory = async_sessionmaker(
        bind=connection, class_=AsyncSession, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )
    session = session_factory()

    yield session

    await session.close()
    await transaction.rollback()
    await connection.close()


@pytest_asyncio.fixture
async def client(db_session):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded(db_session):
    """Roles, permissions, and every module's workflow definitions -
    the baseline every other fixture builds on."""
    await seed_permissions(db_session)
    await seed_lead_pipeline(db_session)
    await seed_case_pipeline(db_session)
    await seed_admissions_pipeline(db_session)
    await seed_document_categories(db_session)
    await db_session.commit()


@pytest_asyncio.fixture
async def branch(db_session, seeded) -> Branch:
    b = Branch(name="Test Branch", code=f"TB-{uuid.uuid4().hex[:6]}")
    db_session.add(b)
    await db_session.commit()
    await db_session.refresh(b)
    return b


async def make_user(db_session, role_key: str, branch=None, **overrides) -> User:
    role_result = await db_session.execute(Role.__table__.select().where(Role.key == role_key))
    role_row = role_result.first()
    assert role_row is not None, f"Role '{role_key}' not seeded"

    defaults = dict(
        email=f"{role_key}-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("testpassword123"),
        full_name=f"Test {role_key.title()}",
        role_id=role_row.id,
        branch_id=branch.id if branch else None,
        is_active=True,
    )
    defaults.update(overrides)
    user = User(**defaults)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


def auth_headers(user: User) -> dict:
    """Issues a real access token directly (bypassing /auth/login) so
    tests that aren't specifically testing login don't need the extra
    round trip."""
    token = create_access_token(subject=str(user.id))
    return {"Authorization": f"Bearer {token}"}
