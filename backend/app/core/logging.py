"""
Structured logging via structlog.

This has been in requirements.txt since Phase 1 but nothing ever called
`structlog.configure()` - every log line until now was whatever FastAPI/
uvicorn emitted by default. This is the same category of gap Redis was
before Phase 15: a dependency that was configured in name only.

Call `configure_logging()` once at startup (see app/main.py). Everywhere
else in the app, get a logger with `structlog.get_logger(__name__)` and
log with keyword arguments - that's what makes the output structured
(JSON in production, readable console output in development) instead of
opaque string interpolation.
"""
import logging
import sys

import structlog

from app.core.config import get_settings

settings = get_settings()


def configure_logging() -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    )

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.ENVIRONMENT == "production":
        # JSON in production - this is what a log aggregator (Railway's
        # own log viewer, or anything downstream of it) actually wants.
        renderer = structlog.processors.JSONRenderer()
    else:
        # Readable, colored console output for local development.
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=shared_processors + [structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[structlog.stdlib.ProcessorFormatter.remove_processors_meta, renderer],
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
