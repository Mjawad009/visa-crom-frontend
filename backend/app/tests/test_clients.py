import pytest

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def _create_and_convert_lead(client, headers, full_name="Convertible Lead"):
    created = await client.post("/api/v1/leads/", json={"full_name": full_name, "source": "website"}, headers=headers)
    lead_id = created.json()["id"]
    for key in ("contact", "qualify", "send_proposal", "convert"):
        await client.post(f"/api/v1/leads/{lead_id}/transition", json={"transition_key": key}, headers=headers)
    return lead_id


async def test_cannot_create_client_from_unconverted_lead(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    lead = await client.post(
        "/api/v1/leads/", json={"full_name": "Still New", "source": "website"}, headers=auth_headers(consultant)
    )
    response = await client.post(
        "/api/v1/clients/",
        json={"full_name": "Still New", "lead_id": lead.json()["id"]},
        headers=auth_headers(consultant),
    )
    assert response.status_code == 400


async def test_can_create_client_from_converted_lead(client, seeded, db_session, branch):
    sales = await make_user(db_session, "sales", branch=branch)
    lead_id = await _create_and_convert_lead(client, auth_headers(sales))

    response = await client.post(
        "/api/v1/clients/", json={"full_name": "Convertible Lead", "lead_id": lead_id}, headers=auth_headers(sales)
    )
    # sales has leads.* but not clients.create — confirms the permission
    # boundary is enforced even when the business rule (lead converted) passes.
    assert response.status_code == 403


async def test_consultant_can_create_client_from_converted_lead(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    lead_id = await _create_and_convert_lead(client, auth_headers(consultant), full_name="Consultant Convert")

    response = await client.post(
        "/api/v1/clients/",
        json={"full_name": "Consultant Convert", "lead_id": lead_id},
        headers=auth_headers(consultant),
    )
    assert response.status_code == 201
    assert response.json()["lead_id"] == lead_id


async def test_deactivate_requires_separate_permission(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    created = await client.post(
        "/api/v1/clients/", json={"full_name": "Cannot Deactivate Me"}, headers=auth_headers(consultant)
    )
    client_id = created.json()["id"]

    # consultant has clients.update but not clients.deactivate
    response = await client.patch(
        f"/api/v1/clients/{client_id}", json={"is_active": False}, headers=auth_headers(consultant)
    )
    assert response.status_code == 403


async def test_branch_manager_can_deactivate(client, seeded, db_session, branch):
    manager = await make_user(db_session, "branch_manager", branch=branch)
    created = await client.post(
        "/api/v1/clients/", json={"full_name": "Can Be Deactivated"}, headers=auth_headers(manager)
    )
    client_id = created.json()["id"]

    response = await client.patch(
        f"/api/v1/clients/{client_id}", json={"is_active": False}, headers=auth_headers(manager)
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False
