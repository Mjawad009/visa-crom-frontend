#!/usr/bin/env bash
# Run this once, the first time you have a reachable Postgres (local via
# `docker compose up -d postgres`, or a real Railway/staging instance
# with DATABASE_URL pointed at it).
#
# This cannot be run inside the sandbox that built this project — no
# network access to install SQLAlchemy/Alembic/asyncpg, no Postgres, no
# Docker. This script exists so that when you *do* have a real
# environment, generating the first migration is a copy-paste away
# instead of something to remember or reconstruct from DEPLOYMENT.md.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing dependencies (if not already installed)..."
pip install -r requirements.txt --break-system-packages 2>/dev/null || pip install -r requirements.txt

echo "==> Generating the first migration from current models..."
alembic revision --autogenerate -m "initial schema"

echo "==> Applying it..."
alembic upgrade head

echo "==> Seeding roles, permissions, workflow pipelines, document categories..."
python -m scripts.seed

echo ""
echo "Done. Review the generated file in alembic/versions/ before committing it —"
echo "autogenerate is reliable but not infallible; skim it for anything"
echo "surprising (a dropped column, an unexpected type change) before trusting it."
