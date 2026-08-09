"""Seeds default document categories. Idempotent."""
from sqlalchemy import select

from app.modules.files.models import DocumentCategory

DEFAULT_CATEGORIES = [
    ("passport", "Passport", True),
    ("national_id", "National ID", True),
    ("bank_statement", "Bank Statement", False),
    ("offer_letter", "Offer Letter", False),
    ("ielts_certificate", "IELTS / Language Certificate", True),
    ("cv", "CV / Resume", False),
    ("photo", "Passport Photo", False),
    ("visa_application_form", "Visa Application Form", False),
    ("medical_certificate", "Medical Certificate", True),
    ("police_clearance", "Police Clearance Certificate", True),
    ("other", "Other", False),
]


async def seed_document_categories(db) -> None:
    for key, name, expiry_tracking in DEFAULT_CATEGORIES:
        existing = (await db.execute(select(DocumentCategory).where(DocumentCategory.key == key))).scalar_one_or_none()
        if not existing:
            db.add(DocumentCategory(key=key, name=name, expiry_tracking_enabled=expiry_tracking))
    await db.commit()
