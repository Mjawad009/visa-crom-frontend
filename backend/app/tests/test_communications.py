import pytest
from unittest.mock import AsyncMock, patch

from app.tests.conftest import auth_headers, make_user

pytestmark = pytest.mark.asyncio


async def test_email_channel_requires_recipient(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    response = await client.post(
        "/api/v1/communications/",
        json={"entity_type": "client", "entity_id": "comm-test", "channel": "email", "body": "Hello"},
        headers=auth_headers(consultant),
    )
    assert response.status_code == 422  # pydantic validator: recipient_email required for channel="email"


async def test_email_channel_calls_send_email(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    with patch("app.modules.communications.service.send_email", new=AsyncMock()) as mock_send:
        response = await client.post(
            "/api/v1/communications/",
            json={
                "entity_type": "client", "entity_id": "comm-test-2", "channel": "email",
                "recipient_email": "client@example.com", "subject": "Update", "body": "Your case has moved forward.",
            },
            headers=auth_headers(consultant),
        )
        assert response.status_code == 201
        mock_send.assert_awaited_once()


async def test_internal_note_never_calls_send_email(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    with patch("app.modules.communications.service.send_email", new=AsyncMock()) as mock_send:
        response = await client.post(
            "/api/v1/communications/",
            json={"entity_type": "client", "entity_id": "comm-test-3", "channel": "internal_note", "body": "Internal only."},
            headers=auth_headers(consultant),
        )
        assert response.status_code == 201
        mock_send.assert_not_awaited()


async def test_list_returns_both_channels_for_the_entity(client, seeded, db_session, branch):
    consultant = await make_user(db_session, "consultant", branch=branch)
    with patch("app.modules.communications.service.send_email", new=AsyncMock()):
        await client.post(
            "/api/v1/communications/",
            json={"entity_type": "client", "entity_id": "comm-test-4", "channel": "internal_note", "body": "Note one."},
            headers=auth_headers(consultant),
        )
        await client.post(
            "/api/v1/communications/",
            json={
                "entity_type": "client", "entity_id": "comm-test-4", "channel": "email",
                "recipient_email": "x@example.com", "body": "Email one.",
            },
            headers=auth_headers(consultant),
        )

    response = await client.get(
        "/api/v1/communications/?entity_type=client&entity_id=comm-test-4", headers=auth_headers(consultant)
    )
    channels = {c["channel"] for c in response.json()}
    assert channels == {"internal_note", "email"}
