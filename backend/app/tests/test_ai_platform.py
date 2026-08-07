import pytest
from unittest.mock import AsyncMock, patch

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def test_generate_sop_denied_for_unrelated_consultant(client, seeded, db_session, branch):
    """The Phase 12 addition: ownership must be checked on entity-
    referencing AI endpoints, not just ai.use_assistant."""
    owner = await make_user(db_session, "consultant", branch=branch)
    other = await make_user(db_session, "consultant", branch=branch)

    created = await client.post(
        "/api/v1/clients/",
        json={"full_name": "AI Owned Client", "assigned_consultant_id": str(owner.id)},
        headers=auth_headers(owner),
    )
    client_id = created.json()["id"]

    with patch("app.modules.ai.routes.chat", new=AsyncMock(return_value="draft text")):
        response = await client.post(
            "/api/v1/ai/generate-sop", json={"client_id": client_id, "additional_context": "test"}, headers=auth_headers(other)
        )
    assert response.status_code == 403


async def test_generate_sop_allowed_for_owning_consultant(client, seeded, db_session, branch):
    owner = await make_user(db_session, "consultant", branch=branch)
    created = await client.post(
        "/api/v1/clients/",
        json={"full_name": "AI Owned Client 2", "assigned_consultant_id": str(owner.id)},
        headers=auth_headers(owner),
    )
    client_id = created.json()["id"]

    with patch("app.modules.ai.routes.chat", new=AsyncMock(return_value="draft SOP text")):
        response = await client.post(
            "/api/v1/ai/generate-sop", json={"client_id": client_id, "additional_context": "test"}, headers=auth_headers(owner)
        )
    assert response.status_code == 200
    assert response.json()["content"] == "draft SOP text"


async def test_visa_pathway_suggestions_always_includes_disclaimer(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    created = await client.post(
        "/api/v1/clients/",
        json={"full_name": "Pathway Client", "assigned_consultant_id": str(consultant.id)},
        headers=auth_headers(consultant),
    )
    client_id = created.json()["id"]

    with patch("app.modules.ai.routes.chat", new=AsyncMock(return_value="Consider a study visa.")):
        response = await client.post(
            "/api/v1/ai/visa-pathway-suggestions",
            json={"client_id": client_id, "destination_country": "Canada", "purpose": "study"},
            headers=auth_headers(consultant),
        )
    assert response.status_code == 200
    assert "not legal immigration advice" in response.json()["disclaimer"]


async def test_branch_manager_bypasses_ownership_via_view_all(client, seeded, db_session, branch):
    owner = await make_user(db_session, "consultant", branch=branch)
    manager = await make_user(db_session, "branch_manager", branch=branch)
    created = await client.post(
        "/api/v1/clients/",
        json={"full_name": "Manager Visible Client", "assigned_consultant_id": str(owner.id)},
        headers=auth_headers(owner),
    )
    client_id = created.json()["id"]

    with patch("app.modules.ai.routes.chat", new=AsyncMock(return_value="summary text")):
        response = await client.post(
            "/api/v1/ai/client-summary", json={"client_id": client_id}, headers=auth_headers(manager)
        )
    assert response.status_code == 200
