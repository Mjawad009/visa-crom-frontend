# Deployment Runbook - Phase 17

Backend on Railway, frontend on Vercel, per the original tech stack.
This is a step-by-step guide for the first production deploy, not just
a config reference.

## 1. Accounts and external services needed

- **Railway** - backend, Postgres, Redis
- **Vercel** - frontend
- **Cloudflare R2** - document storage (create a bucket + API token)
- **Resend** - email, with a verified sending domain
- **OpenRouter** - API key for the AI Service
- **Meilisearch** - self-hosted (e.g. a small Railway service from the
  `getmeili/meilisearch` image) or Meilisearch Cloud. Note: as flagged in
  Phase 7/12, this project doesn't actually use Meilisearch for search
  yet (document/knowledge search use pragmatic ILIKE queries instead) -
  only provision this if you're planning to build the real
  Meilisearch-backed global search that's still on the backlog.

## 2. Backend - Railway

1. Create a new Railway project. Add **Postgres** and **Redis** as
   managed plugins - this gives you `DATABASE_URL`-shaped and
   `REDIS_URL`-shaped connection strings automatically (Railway names
   them differently; map them to the exact env var names below).
2. Add a third service from this repo's `backend/` directory, using the
   Dockerfile (Railway auto-detects `backend/Dockerfile` and
   `backend/railway.json`).
3. Set these environment variables on the backend service:

   | Variable | Notes |
   |---|---|
   | `ENVIRONMENT` | `production` - switches logging to JSON (see `app/core/logging.py`) |
   | `DEBUG` | `false` |
   | `JWT_SECRET_KEY` | Generate a long random value. Never reuse the value from `.env.example`. |
   | `DATABASE_URL` | From Railway's Postgres plugin, in `postgresql+asyncpg://...` form |
   | `REDIS_URL` | From Railway's Redis plugin |
   | `CORS_ORIGINS` | `["https://your-app.vercel.app"]` - must be your real Vercel domain, not localhost |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT_URL` | From Cloudflare R2 |
   | `OPENROUTER_API_KEY` | From OpenRouter |
   | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | From Resend, using your verified domain |

4. First deploy, then **once** (via Railway's shell/exec, or a one-off job):
   ```bash
   alembic revision --autogenerate -m "initial schema"   # first time only - see Phase 2 note
   alembic upgrade head
   python -m scripts.seed
   ```
5. Create the first CEO user directly (there's no bootstrap endpoint -
   `POST /users` itself requires `users.create`, which nobody has yet):
   a one-off Python shell via Railway exec, using
   `app.modules.users.service.UserService` and `app.core.security.hash_password`
   directly against the seeded `ceo` role, is the simplest path.
6. Confirm `/api/v1/health/ready` returns `{"status": "ok", "database": "connected"}`.

## 3. Frontend - Vercel

1. Import this repo into Vercel, root directory `frontend/`.
2. Set `NEXT_PUBLIC_API_BASE_URL` to your Railway backend's public URL
   plus `/api/v1` (e.g. `https://your-backend.up.railway.app/api/v1`).
3. Deploy. Vercel auto-deploys on every push to `main` via its own
   GitHub integration - no custom GitHub Actions workflow was written
   for the frontend, unlike the backend's `deploy-backend.yml`.
4. Confirm CORS is actually correct by loading the deployed frontend and
   attempting login - a misconfigured `CORS_ORIGINS` on the backend is
   the most common first-deploy failure and shows up as a browser
   console CORS error, not a helpful backend error message.

## 4. CI/CD already wired up (Phase 15/16/17)

- `.github/workflows/backend-tests.yml` - runs the Phase 16 test suite
  against real Postgres + Redis service containers on every push/PR
  touching `backend/`.
- `.github/workflows/deploy-backend.yml` - on push to `main`, reruns
  the same test suite, then deploys to Railway via the Railway CLI.
  Requires a `RAILWAY_TOKEN` repo secret (Railway dashboard -> project
  settings -> generate a token).

## 5. Rollback

- **Railway**: every deploy is kept; roll back to a previous deploy from
  the service's Deployments tab.
- **Vercel**: same - every deployment is kept and instantly promotable
  from the dashboard.

## 6. Observability, honestly

Structured JSON logs (Phase 17) go to stdout, which Railway captures and
shows in its log viewer - that's the extent of what's built. No log
aggregation service (Datadog, etc.), no error tracking (Sentry, etc.),
and no uptime monitoring are wired up. All three are reasonable
additions once there's real production traffic to justify the cost;
none are hard to add on top of what's here (structured logs make
shipping to any aggregator later a config change, not a rewrite).

## 7. What's still a known gap at this point

- No first migration file exists yet in `alembic/versions/` - every
  phase noted this honestly rather than faking one against a database
  that was never reachable in this sandbox. Step 4 above is where it
  finally gets generated, against a real database, for the first time.
- No frontend test coverage (flagged in Phase 16).
- Meilisearch-backed global/document search was never built; ILIKE
  queries stand in for it (flagged in Phase 7/12/13).
- No load testing has been done - Phase 15's performance work
  (indexes, N+1 fixes, caching, pagination) is reasoned about, not
  benchmarked against real traffic.
