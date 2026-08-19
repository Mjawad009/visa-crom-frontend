import pytest

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def _create_active_client(client, headers, full_name="Case Test Client"):
    created = await client.post("/api/v1/clients/", json={"full_name": full_name}, headers=headers)
    return created.json()["id"]


async def test_cannot_open_case_for_inactive_client(client, seeded, db_session, branch):
    manager = await make_user(db_session, "branch_manager", branch=branch)
    consultant = await make_user(db_session, "consultant", branch=branch)
    client_id = await _create_active_client(client, auth_headers(manager))
    await client.patch(f"/api/v1/clients/{client_id}", json={"is_active": False}, headers=auth_headers(manager))

    response = await client.post(
        "/api/v1/cases/", json={"client_id": client_id, "case_type": "study_visa"}, headers=auth_headers(consultant)
    )
    assert response.status_code == 400


async def test_case_gets_a_generated_reference(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    client_id = await _create_active_client(client, auth_headers(consultant))

    response = await client.post(
        "/api/v1/cases/", json={"client_id": client_id, "case_type": "study_visa"}, headers=auth_headers(consultant)
    )
    assert response.status_code == 201
    body = response.json()
    assert body["reference"].startswith("VC-")
    assert body["current_stage_key"] == "consultation"


async def test_close_unsuccessful_sets_is_closed(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    client_id = await _create_active_client(client, auth_headers(consultant))
    created = await client.post(
        "/api/v1/cases/", json={"client_id": client_id, "case_type": "study_visa"}, headers=auth_headers(consultant)
    )
    case_id = created.json()["id"]

    response = await client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"transition_key": "close_unsuccessful"},
        headers=auth_headers(consultant),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["is_closed"] is True
    assert body["current_stage_key"] == "closed_unsuccessful"


async def test_reaching_post_visa_support_does_not_close_the_case(client, seeded, db_session, branch):
    """Documents the Phase 6 design call: post_visa_support is ongoing
    support, not an ending — only close_unsuccessful sets is_closed."""
    consultant = await make_user(db_session, "consultant", branch=branch)
    client_id = await _create_active_client(client, auth_headers(consultant))
    created = await client.post(
        "/api/v1/cases/", json={"client_id": client_id, "case_type": "study_visa"}, headers=auth_headers(consultant)
    )
    case_id = created.json()["id"]

    # consultation -> document_collection -> ... -> post_visa_support (9 advances)
    last_response = None
    for _ in range(9):
        last_response = await client.post(
            f"/api/v1/cases/{case_id}/transition", json={"transition_key": "advance"}, headers=auth_headers(consultant)
        )
    assert last_response.json()["current_stage_key"] == "post_visa_support"
    assert last_response.json()["is_closed"] is False


async def test_case_list_includes_client_name(client, seeded, db_session, branch):
    """Confirms the Phase 8 client_full_name addition still works after
    the Phase 15 batch-lookup refactor."""
    consultant = await make_user(db_session, "consultant", branch=branch)
    client_id = await _create_active_client(client, auth_headers(consultant), full_name="Named Client")
    await client.post(
        "/api/v1/cases/", json={"client_id": client_id, "case_type": "study_visa"}, headers=auth_headers(consultant)
    )

    response = await client.get("/api/v1/cases/", headers=auth_headers(consultant))
    assert response.status_code == 200
    assert any(c["client_full_name"] == "Named Client" for c in response.json())
