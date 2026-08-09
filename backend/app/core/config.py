"""
Central application configuration.

All environment-driven settings live here. No module should read
os.environ directly — everything goes through this Settings object,
so config stays a single, swappable seam (e.g. swapping OpenRouter
models, or moving from R2 to another object store, never touches
business logic).
"""
from functools import lru_cache
from typing import List

from pydantic import AnyUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- App ---
    APP_NAME: str = "Visa Consultancy CRM"
    ENVIRONMENT: str = "development"  # development | staging | production
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # --- Security / Auth ---
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    PASSWORD_HASH_SCHEME: str = "bcrypt"

    # --- CORS ---
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # --- Database (PostgreSQL on Railway) ---
    DATABASE_URL: str  # postgresql+asyncpg://user:pass@host:port/db

    # --- Cache (Redis on Railway) ---
    REDIS_URL: str

    # --- Document Storage (Cloudflare R2, S3-compatible) ---
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_ENDPOINT_URL: str = ""

    # --- Search (Meilisearch) ---
    MEILISEARCH_URL: str = "http://localhost:7700"
    MEILISEARCH_API_KEY: str = ""

    # --- OCR ---
    TESSERACT_CMD: str = "/usr/bin/tesseract"

    # --- AI (OpenRouter — provider-agnostic) ---
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_DEFAULT_MODEL: str = "anthropic/claude-sonnet-4"

    # --- Email (Resend) ---
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "no-reply@example.com"

    # --- SMS / WhatsApp (Twilio) ---
    # Stub-ready, not yet wired to a live send call anywhere — see
    # app/shared/reminders.py. Adding real keys here is the entire
    # migration from stubbed to live once the business is ready.
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_SMS_FROM_NUMBER: str = ""
    TWILIO_WHATSAPP_FROM_NUMBER: str = ""


@lru_cache
def get_settings() -> Settings:
    """Settings are cached so env parsing happens once per process."""
    return Settings()  # type: ignore[call-arg]
