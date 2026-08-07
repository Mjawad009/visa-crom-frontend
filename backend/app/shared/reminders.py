"""
Reminder dispatch — single seam for turning a due Task reminder into an
actual notification, on whatever channel the task asked for.

Mirrors app/shared/email.py's discipline: one file, swappable
underneath. Today:
  - "in_app" and "email" are fully live — both ride the existing
    Notifications module (Phase 2) and its Resend email hook.
  - "sms" and "whatsapp" are accepted as valid values everywhere (the
    schema, the UI) but only log a structured "would have sent" event
    and still fall back to an in-app notification, so nothing is
    silently dropped. Wiring a real provider (Twilio is the natural
    choice given TWILIO_* is already in Settings) means filling in
    `_send_sms` / `_send_whatsapp` below — no other file changes.
"""
import structlog

from app.core.config import get_settings
from app.modules.notifications.schemas import NotificationCreate
from app.modules.notifications.service import NotificationService

logger = structlog.get_logger(__name__)
settings = get_settings()


async def _send_sms(to_phone: str | None, title: str, body: str) -> None:
    if not settings.TWILIO_ACCOUNT_SID or not to_phone:
        logger.info("reminder.sms.stubbed", to=to_phone, title=title)
        return
    # TODO(twilio): from twilio.rest import Client; Client(sid, token).messages.create(...)
    logger.info("reminder.sms.stubbed", to=to_phone, title=title)


async def _send_whatsapp(to_phone: str | None, title: str, body: str) -> None:
    if not settings.TWILIO_ACCOUNT_SID or not to_phone:
        logger.info("reminder.whatsapp.stubbed", to=to_phone, title=title)
        return
    # TODO(twilio): same client as SMS, "whatsapp:+<number>" addressing.
    logger.info("reminder.whatsapp.stubbed", to=to_phone, title=title)


async def dispatch_task_reminder(db, task) -> None:
    """Called by TaskService when a task's reminder comes due. Always
    creates the in-app notification regardless of the requested channel
    — SMS/WhatsApp are additive, never a replacement for the in-app
    inbox, so a missing provider key never means the assignee hears
    nothing at all."""
    from app.modules.users.models import User

    body = f"Due {task.due_at.isoformat()}" + (f" — {task.description}" if task.description else "")

    await NotificationService(db).notify(
        NotificationCreate(
            user_id=task.assigned_to_user_id,
            title=f"Reminder: {task.title}",
            body=body,
            type="info",
            link=None,
            send_email=task.reminder_channel == "email",
        )
    )

    if task.reminder_channel in ("sms", "whatsapp"):
        user = await db.get(User, task.assigned_to_user_id)
        phone = user.phone if user else None
        if task.reminder_channel == "sms":
            await _send_sms(phone, task.title, body)
        else:
            await _send_whatsapp(phone, task.title, body)
