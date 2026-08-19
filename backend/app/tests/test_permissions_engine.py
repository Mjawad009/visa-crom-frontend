import pytest

from app.modules.permissions.models import Role
from app.modules.permissions.service import PermissionEngineService
from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def test_require_permission_blocks_without_grant(client, seeded, db_session, branch):
    # Sales has no cases.* grants at all (see permissions/seed.py)
    user = await make_user(db_session, "sales", branch=branch)
    response = await client.get("/api/v1/cases/", headers=auth_headers(user))
    assert response.status_code == 403


async def test_require_permission_allows_with_grant(client, seeded, db_session, branch):
    user = await make_user(db_session, "consultant", branch=branch)
    response = await client.get("/api/v1/cases/", headers=auth_headers(user))
    assert response.status_code == 200


async def test_superuser_bypasses_all_permission_checks(client, seeded, db_session, branch):
    # CEO role has every permission by seed, but is_superuser should mean
    # "even if a grant were missing, still let them through."
    user = await make_user(db_session, "ceo", branch=branch, is_superuser=True)
    response = await client.get("/api/v1/reports/branch-performance", headers=auth_headers(user))
    assert response.status_code == 200


async def test_role_permission_change_takes_effect_after_cache_invalidation(client, seeded, db_session, branch):
    """Confirms the Phase 15 Redis caching change didn't break the
    expectation that permission edits take effect immediately, not
    after a 5-minute TTL."""
    user = await make_user(db_session, "sales", branch=branch)

    # Before: sales has no cases.view
    before = await client.get("/api/v1/cases/", headers=auth_headers(user))
    assert before.status_code == 403

    # Prime the cache with the "before" state, then grant cases.view.
    role_result = await db_session.execute(Role.__table__.select().where(Role.key == "sales"))
    sales_role = role_result.first()
    service = PermissionEngineService(db_session)
    current_grants = await service.get_role_permissions(sales_role.id)
    await service.set_role_permissions(sales_role.id, current_grants + ["cases.view"], actor_user_id=user.id)

    after = await client.get("/api/v1/cases/", headers=auth_headers(user))
    assert after.status_code == 200
