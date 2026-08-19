"""
Run with: python -m scripts.seed

Seeds the 11 system roles and Core Platform permission keys defined in
app/modules/permissions/seed.py, plus each business module's workflow
definitions (e.g. Leads' pipeline). Safe to re-run (idempotent).
"""
import asyncio

from app.db.session import AsyncSessionLocal
from app.modules.admissions.seed import seed_admissions_pipeline
from app.modules.cases.seed import seed_case_pipeline
from app.modules.files.seed import seed_document_categories
from app.modules.leads.seed import seed_lead_pipeline
from app.modules.permissions.seed import seed_permissions


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await seed_permissions(db)
        await seed_lead_pipeline(db)
        await seed_case_pipeline(db)
        await seed_admissions_pipeline(db)
        await seed_document_categories(db)
    print("Roles, permissions, workflow definitions, and document categories seeded.")


if __name__ == "__main__":
    asyncio.run(main())
