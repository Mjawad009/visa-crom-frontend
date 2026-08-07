# --- Builder stage: compile dependencies with build tools available ---
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt


# --- Runtime stage: slim image, no compilers, non-root user ---
FROM python:3.12-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 appuser

WORKDIR /app
COPY --from=builder /root/.local /home/appuser/.local
COPY . .
RUN chown -R appuser:appuser /app

USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# gunicorn manages uvicorn workers — the dev server (`uvicorn app.main:app`
# directly) has no process supervision and is single-worker only, fine for
# local development but not for production.
#
# Shell form (not exec-array form) is required here so $PORT actually
# expands — Railway injects its own PORT env var at runtime and expects
# the app to bind to it; a hardcoded port will not be reachable.
CMD gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 4 \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 60 \
    --access-logfile - \
    --error-logfile -
