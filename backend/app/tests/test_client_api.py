import pytest
from unittest.mock import AsyncMock, patch

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def test_me_endpoints_404_without_a_linked_client(client, seeded, db_session, branch):
    client_user = await make_user(db_session, "client", branch=branch)
    response = await client.get("/api/v1/me/profile", headers=auth_headers(client_user))
    assert response.status_code == 404


async def test_me_profile_returns_linked_client_data(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    client_user = await make_user(db_session, "client", branch=branch)

    created = await client.post(
        "/api/v1/clients/",
        json={"full_name": "Self Service Client", "passport_number": "X1234567"},
        headers=auth_headers(consultant),
    )
    client_id = created.json()["id"]
    await client.patch(f"/api/v1/clients/{client_id}", json={"user_id": str(client_user.id)}, headers=auth_headers(consultant))

    response = await client.get("/api/v1/me/profile", headers=auth_headers(client_user))
    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Self Service Client"
    assert body["passport_number"] == "X1234567"  # the one deliberate exception to "no passport in public.py"


async def test_me_communications_excludes_internal_notes(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    client_user = await make_user(db_session, "client", branch=branch)

    created = await client.post("/api/v1/clients/", json={"full_name": "Comm Test Client"}, headers=auth_headers(consultant))
    client_id = created.json()["id"]
    await client.patch(f"/api/v1/clients/{client_id}", json={"user_id": str(client_user.id)}, headers=auth_headers(consultant))

    with patch("app.modules.communications.service.send_email", new=AsyncMock()):
        await client.post(
            "/api/v1/communications/",
            json={"entity_type": "client", "entity_id": client_id, "channel": "internal_note", "body": "Staff-only note."},
            headers=auth_headers(consultant),
        )
        await client.post(
            "/api/v1/communications/",
            json={
                "entity_type": "client", "entity_id": client_id, "channel": "email",
                "recipient_email": "client@example.com", "subject": "Hi", "body": "Visible to the client.",
            },
            headers=auth_headers(consultant),
        )

    response = await client.get("/api/v1/me/communications", headers=auth_headers(client_user))
    bodies = [c["body"] for c in response.json()]
    assert "Visible to the client." in bodies
    assert "Staff-only note." not in bodies


async def test_me_routes_have_no_write_verbs(client, seeded):
    """Structural guarantee, not just a behavioral one: this module
    should never grow a POST/PATCH/DELETE route by accident."""
    from app.modules.client_api.routes import router

    methods = {method for route in router.routes for method in route.methods}
    assert methods == {"GET"}
