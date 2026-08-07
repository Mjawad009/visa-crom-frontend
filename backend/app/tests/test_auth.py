import pytest

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def test_login_rejects_wrong_password(client, seeded, db_session, branch):
    user = await make_user(db_session, "consultant", branch=branch)
    response = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "wrong-password"})
    assert response.status_code == 401


async def test_login_succeeds_and_returns_both_tokens(client, seeded, db_session, branch):
    user = await make_user(db_session, "consultant", branch=branch, email="login-test@example.com")
    # make_user hashes "testpassword123" for every user by default
    response = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "testpassword123"})
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body


async def test_me_requires_a_token(client, seeded):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_me_returns_role_and_permissions(client, seeded, db_session, branch):
    user = await make_user(db_session, "consultant", branch=branch)
    response = await client.get("/api/v1/auth/me", headers=auth_headers(user))
    assert response.status_code == 200
    body = response.json()
    assert body["role_key"] == "consultant"
    assert "leads.view" in body["permissions"]
    assert "leads.view_all" not in body["permissions"]  # consultants get own-only, not view_all


async def test_refresh_rotates_the_token(client, seeded, db_session, branch):
    user = await make_user(db_session, "consultant", branch=branch)
    login = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "testpassword123"})
    original_refresh = login.json()["refresh_token"]

    refreshed = await client.post("/api/v1/auth/refresh", json={"refresh_token": original_refresh})
    assert refreshed.status_code == 200
    new_refresh = refreshed.json()["refresh_token"]
    assert new_refresh != original_refresh

    # The old refresh token must now be dead — this is the whole point of rotation.
    reused = await client.post("/api/v1/auth/refresh", json={"refresh_token": original_refresh})
    assert reused.status_code == 401


async def test_logout_revokes_the_refresh_token(client, seeded, db_session, branch):
    user = await make_user(db_session, "consultant", branch=branch)
    login = await client.post("/api/v1/auth/login", json={"email": user.email, "password": "testpassword123"})
    refresh_token = login.json()["refresh_token"]

    logout = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout.status_code == 204

    reuse_attempt = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert reuse_attempt.status_code == 401


async def test_inactive_user_is_rejected(client, seeded, db_session, branch):
    user = await make_user(db_session, "consultant", branch=branch, is_active=False)
    response = await client.get("/api/v1/auth/me", headers=auth_headers(user))
    assert response.status_code == 401
