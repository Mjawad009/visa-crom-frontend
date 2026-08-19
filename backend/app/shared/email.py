"""
Email sending — single seam over Resend.

Any module needing to send email calls `send_email()` here. If Resend
is ever swapped for another provider, this is the only file that changes.
"""
import resend

from app.core.config import get_settings

settings = get_settings()
resend.api_key = settings.RESEND_API_KEY


async def send_email(to: str, subject: str, html: str) -> None:
    if not settings.RESEND_API_KEY:
        # Local/dev without a key configured: no-op rather than crash.
        return
    resend.Emails.send(
        {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        }
    )
