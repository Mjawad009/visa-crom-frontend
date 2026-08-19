"""
Application entrypoint.

This file wires together config, middleware, and enabled modules.
It should stay thin forever — it must never contain business logic.
"""
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.module_registry import register_modules
from app.core.request_logging import log_requests_middleware
from app.db import models_registry  # noqa: F401 -- side effect: registers all models
from app.db.session import AsyncSessionLocal

from contextlib import asynccontextmanager


async def _bootstrap_admin() -> None:
    """One-time bootstrap: creates tables, seeds roles/permissions, and
    creates a default admin login if none exists. Safe to run every
    startup and safe across multiple concurrent workers -- races are
    swallowed since only one worker needs to succeed. Runs in the
    background so it never blocks app startup or the healthcheck."""
    from sqlalchemy import select
    from sqlalchemy.exc import IntegrityError
    from app.db.session import AsyncSessionLocal, engine
    from app.db.base import Base
    from app.modules.permissions.seed import seed_permissions
    from app.modules.leads.seed import seed_lead_pipeline
    from app.modules.cases.seed import seed_case_pipeline
    from app.modules.admissions.seed import seed_admissions_pipeline
    from app.modules.files.seed import seed_document_categories
    from app.modules.permissions.models import Role
    from app.modules.users.models import User
    from app.core.security import hash_password

    admin_email = "admin@visacrm.com"
    admin_password = "VisaCrm!2026Admin"

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except IntegrityError:
        pass

    try:
        async with AsyncSessionLocal() as db:
            await seed_permissions(db)
            await seed_lead_pipeline(db)
            await seed_case_pipeline(db)
            await seed_admissions_pipeline(db)
            await seed_document_categories(db)
            await db.commit()
    except IntegrityError:
        pass

    try:
        async with AsyncSessionLocal() as db:
            role = (await db.execute(
                select(Role).where(Role.key == "ceo")
            )).scalar_one()
    
            existing = (await db.execute(
                select(User).where(User.email == admin_email)
            )).scalar_one_or_none()
    
            print("Admin email:", admin_email)
            print("Role:", role)
            print("Existing:", existing)
    
            if existing is None:
                db.add(
                    User(
                        email=admin_email,
                        hashed_password=hash_password(admin_password),
                        full_name="Admin",
                        role_id=role.id,
                        is_superuser=True,
                        is_active=True,
                    )
                )
                await db.commit()
                print("✅ Admin user created")
            else:
                print("ℹ️ Admin already exists")
    
    except Exception as e:
        import traceback
        print("❌ BOOTSTRAP ERROR:", e)
        traceback.print_exc()


@asynccontextmanager
async def _lifespan(app: FastAPI):
    # Fire-and-forget: don't block startup/healthcheck on this.
    asyncio.create_task(_bootstrap_admin())
    yield

settings = get_settings()
configure_logging()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        lifespan=_lifespan,
        version="0.1.0",
        debug=settings.DEBUG,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url=f"{settings.API_V1_PREFIX}/docs",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.middleware("http")(log_requests_middleware)

    @app.get(f"{settings.API_V1_PREFIX}/health", tags=["system"])
    async def health_check() -> dict:
        """Liveness check — the process is up. Does not touch the
        database, so it stays fast and can't false-negative on a slow
        query. Use /health/ready for an actual dependency check."""
        return {"status": "ok", "environment": settings.ENVIRONMENT}

    @app.get(f"{settings.API_V1_PREFIX}/health/ready", tags=["system"])
    async def readiness_check() -> dict:
        """Readiness check — confirms the database is actually reachable.
        This is the one Railway (or any orchestrator) should point its
        health check at before routing traffic to a new deploy."""
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
            db_ok = True
        except Exception:
            db_ok = False

        status_str = "ok" if db_ok else "degraded"
        return {"status": status_str, "database": "connected" if db_ok else "unreachable"}

    # Business + core modules mount themselves here. Phase 1 ships this
    # mechanism with zero modules enabled — Phase 2 turns on auth/RBAC/users/branches.
    register_modules(app, settings.API_V1_PREFIX)

    return app


app = create_app()
                    
