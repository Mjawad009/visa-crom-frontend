import pytest

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def test_lead_funnel_reflects_created_leads(client, seeded, db_session, branch):
    manager = await make_user(db_session, "branch_manager", branch=branch)
    await client.post("/api/v1/leads/", json={"full_name": "Funnel Lead 1", "source": "website"}, headers=auth_headers(manager))
    await client.post("/api/v1/leads/", json={"full_name": "Funnel Lead 2", "source": "website"}, headers=auth_headers(manager))

    response = await client.get("/api/v1/reports/funnel/leads", headers=auth_headers(manager))
    assert response.status_code == 200
    stages = {s["stage_key"]: s["count"] for s in response.json()["stages"]}
    assert stages["new"] >= 2


async def test_reports_require_reports_view_permission(client, seeded, db_session, branch):
    # Consultant has no reports.view grant
    consultant = await make_user(db_session, "consultant", branch=branch)
    response = await client.get("/api/v1/reports/funnel/leads", headers=auth_headers(consultant))
    assert response.status_code == 403


async def test_branch_performance_counts_active_clients(client, seeded, db_session, branch):
    manager = await make_user(db_session, "branch_manager", branch=branch)
    await client.post(
        "/api/v1/clients/", json={"full_name": "Reported Client", "branch_id": str(branch.id)}, headers=auth_headers(manager)
    )

    response = await client.get("/api/v1/reports/branch-performance", headers=auth_headers(manager))
    assert response.status_code == 200
    rows = {r["branch_id"]: r for r in response.json()["rows"]}
    assert rows[str(branch.id)]["clients"] >= 1


async def test_document_compliance_reports_pending_count(client, seeded, db_session, branch):
    from unittest.mock import patch

    manager = await make_user(db_session, "branch_manager", branch=branch)
    with patch("app.modules.files.service.generate_upload_url", return_value="https://fake"):
        await client.post(
            "/api/v1/files/upload-url",
            json={"entity_type": "client", "entity_id": "compliance-test", "filename": "doc.jpg", "content_type": "image/jpeg"},
            headers=auth_headers(manager),
        )

    response = await client.get("/api/v1/reports/document-compliance", headers=auth_headers(manager))
    assert response.status_code == 200
    assert response.json()["status_counts"].get("pending", 0) >= 1
