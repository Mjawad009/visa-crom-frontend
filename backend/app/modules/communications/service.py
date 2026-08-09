import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.communications.models import CommunicationLog
from app.modules.communications.schemas import CommunicationCreate
from app.shared.activity import log_activity
from app.shared.email import send_email


class InvalidChannelError(Exception):
    pass


class CommunicationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: CommunicationCreate, actor_user_id: Optional[uuid.UUID]) -> CommunicationLog:
        if data.channel not in ("email", "internal_note"):
            raise InvalidChannelError()

        direction = "outbound" if data.channel == "email" else "internal"
        entry = CommunicationLog(
            entity_type=data.entity_type,
            entity_id=data.entity_id,
            branch_id=data.branch_id,
            channel=data.channel,
            direction=direction,
            sender_user_id=actor_user_id,
            recipient_email=data.recipient_email,
            subject=data.subject,
            body=data.body,
        )
        self.db.add(entry)

        if data.channel == "email":
            # Send first so a delivery failure surfaces before we log
            # success - callers see the real outcome, not a false record.
            await send_email(
                to=data.recipient_email,
                subject=data.subject or "Message from your visa consultancy",
                html=f"<p>{data.body}</p>",
            )

        await log_activity(
            self.db, actor_user_id=actor_user_id, branch_id=data.branch_id, module="communications",
            action=f"{data.channel}_logged", entity_type=data.entity_type, entity_id=data.entity_id,
        )
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def list_for_entity(self, entity_type: str, entity_id: str) -> List[CommunicationLog]:
        result = await self.db.execute(
            select(CommunicationLog)
            .where(CommunicationLog.entity_type == entity_type, CommunicationLog.entity_id == entity_id)
            .order_by(CommunicationLog.created_at.desc())
        )
        return list(result.scalars().all())

    async def search(self, query: str) -> List[CommunicationLog]:
        """Pragmatic ILIKE search, same approach as FileService.search
        (Phase 7) — used by AI Platform's Internal Knowledge Search."""
        like = f"%{query}%"
        result = await self.db.execute(
            select(CommunicationLog)
            .where((CommunicationLog.body.ilike(like)) | (CommunicationLog.subject.ilike(like)))
            .order_by(CommunicationLog.created_at.desc())
            .limit(20)
        )
        return list(result.scalars().all())
