import pytest

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def test_create_lead_starts_the_pipeline_at_new(client, seeded, db_session, branch):
    sales = await make_user(db_session, "sales", branch=branch)
    response = await client.post(
        "/api/v1/leads/",
        json={"full_name": "Jane Applicant", "source": "website"},
        headers=auth_headers(sales),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["current_stage_key"] == "new"
    assert body["is_converted"] is False


async def test_own_only_view_hides_other_users_leads(client, seeded, db_session, branch):
    sales_a = await make_user(db_session, "sales", branch=branch)
    sales_b = await make_user(db_session, "sales", branch=branch)

    await client.post(
        "/api/v1/leads/",
        json={"full_name": "Owned By A", "source": "referral", "assigned_to_user_id": str(sales_a.id)},
        headers=auth_headers(sales_a),
    )

    # sales_b has leads.view (own only), not leads.view_all — should not see A's lead
    response = await client.get("/api/v1/leads/", headers=auth_headers(sales_b))
    assert response.status_code == 200
    names = [lead["full_name"] for lead in response.json()]
    assert "Owned By A" not in names


async def test_view_all_sees_every_lead(client, seeded, db_session, branch):
    sales = await make_user(db_session, "sales", branch=branch)
    manager = await make_user(db_session, "branch_manager", branch=branch)

    await client.post(
        "/api/v1/leads/",
        json={"full_name": "Visible To Manager", "source": "referral", "assigned_to_user_id": str(sales.id)},
        headers=auth_headers(sales),
    )

    response = await client.get("/api/v1/leads/", headers=auth_headers(manager))
    names = [lead["full_name"] for lead in response.json()]
    assert "Visible To Manager" in names


async def test_transition_through_pipeline_to_converted(client, seeded, db_session, branch):
    sales = await make_user(db_session, "sales", branch=branch)
    created = await client.post(
        "/api/v1/leads/", json={"full_name": "Pipeline Walker", "source": "website"}, headers=auth_headers(sales)
    )
    lead_id = created.json()["id"]

    for transition_key, expected_stage in [
        ("contact", "contacted"),
        ("qualify", "qualified"),
        ("send_proposal", "proposal_sent"),
        ("convert", "converted"),
    ]:
        response = await client.post(
            f"/api/v1/leads/{lead_id}/transition", json={"transition_key": transition_key}, headers=auth_headers(sales)
        )
        assert response.status_code == 200, response.text
        assert response.json()["current_stage_key"] == expected_stage

    final = await client.get(f"/api/v1/leads/{lead_id}", headers=auth_headers(sales))
    assert final.json()["is_converted"] is True


async def test_invalid_transition_is_rejected(client, seeded, db_session, branch):
    sales = await make_user(db_session, "sales", branch=branch)
    created = await client.post(
        "/api/v1/leads/", json={"full_name": "Cannot Skip Stages", "source": "website"}, headers=auth_headers(sales)
    )
    lead_id = created.json()["id"]

    # "convert" is only valid from proposal_sent, not from "new"
    response = await client.post(
        f"/api/v1/leads/{lead_id}/transition", json={"transition_key": "convert"}, headers=auth_headers(sales)
    )
    assert response.status_code == 400
