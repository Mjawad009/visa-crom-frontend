import uuid
from typing import List

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification
from app.modules.notifications.schemas import NotificationCreate
from app.modules.users.models import User
from app.shared.email import send_email


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def notify(self, data: NotificationCreate) -> Notification:
        """The one function every other module should call to alert a
        user — e.g. Documents module calls this when a file is rejected,
        Workflow Engine calls this on stage transitions."""
        notification = Notification(
            user_id=data.user_id,
            title=data.title,
            body=data.body,
            type=data.type,
            link=data.link,
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)

        if data.send_email:
            user = await self.db.get(User, data.user_id)
            if user:
                await send_email(to=user.email, subject=data.title, html=f"<p>{data.body or ''}</p>")

        return notification

    async def list_for_user(self, user_id: uuid.UUID, unread_only: bool = False) -> List[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True)
        )
        await self.db.commit()

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        result = await self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True)
        )
        await self.db.commit()
        return result.rowcount or 0
