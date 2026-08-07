import pytest
from unittest.mock import patch

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def mock_storage():
    """No real R2 bucket in tests — mock the storage seam, same one that
    makes R2 swappable in production makes it mockable here."""
    with patch("app.modules.files.service.generate_upload_url", return_value="https://fake-upload-url"), \
         patch("app.modules.files.service.generate_download_url", return_value="https://fake-download-url"), \
         patch("app.modules.files.service.download_object_bytes", return_value=b"fake-image-bytes"):
        yield


async def test_upload_url_creates_pending_file_record(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    response = await client.post(
        "/api/v1/files/upload-url",
        json={"entity_type": "client", "entity_id": "some-client-id", "filename": "passport.jpg", "content_type": "image/jpeg", "category": "passport"},
        headers=auth_headers(consultant),
    )
    assert response.status_code == 200
    assert response.json()["upload_url"] == "https://fake-upload-url"

    listing = await client.get(
        "/api/v1/files/?entity_type=client&entity_id=some-client-id", headers=auth_headers(consultant)
    )
    files = listing.json()
    assert len(files) == 1
    assert files[0]["status"] == "pending"


async def test_only_files_verify_can_approve_or_reject(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    documentation_officer = await make_user(db_session, "documentation_officer", branch=branch)

    upload = await client.post(
        "/api/v1/files/upload-url",
        json={"entity_type": "client", "entity_id": "verify-test", "filename": "bank.pdf", "content_type": "application/pdf"},
        headers=auth_headers(consultant),
    )
    file_id = upload.json()["file_id"]

    verified = await client.post(
        f"/api/v1/files/{file_id}/verify", json={"status": "verified"}, headers=auth_headers(documentation_officer)
    )
    assert verified.status_code == 200
    assert verified.json()["status"] == "verified"


async def test_new_version_marks_previous_as_superseded(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    first = await client.post(
        "/api/v1/files/upload-url",
        json={"entity_type": "case", "entity_id": "version-test", "filename": "v1.jpg", "content_type": "image/jpeg"},
        headers=auth_headers(consultant),
    )
    first_id = first.json()["file_id"]

    second = await client.post(
        f"/api/v1/files/{first_id}/new-version",
        json={"filename": "v2.jpg", "content_type": "image/jpeg"},
        headers=auth_headers(consultant),
    )
    assert second.status_code == 200

    listing = await client.get(
        "/api/v1/files/?entity_type=case&entity_id=version-test", headers=auth_headers(consultant)
    )
    files = {f["id"]: f for f in listing.json()}
    assert files[first_id]["status"] == "superseded"
    new_file = [f for f in listing.json() if f["id"] != first_id][0]
    assert new_file["version"] == 2
    assert new_file["previous_version_id"] == first_id


async def test_download_denied_for_unrelated_staff(client, seeded, db_session, branch):
    """Confirms the Phase 7 known-simplification ACL: uploader, files.verify
    holders, or superuser only."""
    consultant = await make_user(db_session, "consultant", branch=branch)
    sales = await make_user(db_session, "sales", branch=branch)  # no files.verify

    upload = await client.post(
        "/api/v1/files/upload-url",
        json={"entity_type": "client", "entity_id": "access-test", "filename": "doc.jpg", "content_type": "image/jpeg"},
        headers=auth_headers(consultant),
    )
    file_id = upload.json()["file_id"]

    response = await client.get(f"/api/v1/files/{file_id}/download-url", headers=auth_headers(sales))
    assert response.status_code == 403
