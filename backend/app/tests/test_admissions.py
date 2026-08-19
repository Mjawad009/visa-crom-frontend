import pytest

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def test_admissions_officer_sees_only_own_applications(client, seeded, db_session, branch):
    officer_a = await make_user(db_session, "admissions_officer", branch=branch)
    officer_b = await make_user(db_session, "admissions_officer", branch=branch)

    client_created = await client.post(
        "/api/v1/clients/", json={"full_name": "Student One"}, headers=auth_headers(officer_a)
    )
    client_id = client_created.json()["id"]

    await client.post(
        "/api/v1/admissions/",
        json={"client_id": client_id, "institution_name": "State University", "assigned_officer_id": str(officer_a.id)},
        headers=auth_headers(officer_a),
    )

    # officer_b has admissions.view (own only) — confirming the ownership
    # guess made before Phase 10 was checked, not assumed.
    response = await client.get("/api/v1/admissions/", headers=auth_headers(officer_b))
    names = [a["institution_name"] for a in response.json()]
    assert "State University" not in names


async def test_admission_pipeline_reaches_completed(client, seeded, db_session, branch):
    officer = await make_user(db_session, "admissions_officer", branch=branch)
    client_created = await client.post(
        "/api/v1/clients/", json={"full_name": "Student Two"}, headers=auth_headers(officer)
    )
    client_id = client_created.json()["id"]

    created = await client.post(
        "/api/v1/admissions/",
        json={"client_id": client_id, "institution_name": "Tech Institute"},
        headers=auth_headers(officer),
    )
    app_id = created.json()["id"]
    assert created.json()["current_stage_key"] == "preparing_application"

    last_response = None
    for _ in range(5):  # preparing -> submitted -> offer -> deposit -> document_issued -> completed
        last_response = await client.post(
            f"/api/v1/admissions/{app_id}/transition", json={"transition_key": "advance"}, headers=auth_headers(officer)
        )
    assert last_response.json()["current_stage_key"] == "completed"


async def test_admission_not_linked_to_case(client, seeded, db_session, branch):
    """Documents the Phase 10 design decision: Admissions has no case_id
    field at all — this is a schema-shape assertion, not just a behavior one."""
    from app.modules.admissions.schemas import AdmissionApplicationCreate

    assert "case_id" not in AdmissionApplicationCreate.model_fields
