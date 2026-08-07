# Visa Consultancy CRM — Project Documentation

**A complete technical reference: how the system was built, what it can do today, where it should go next, and how to deploy it.**

Companion documents in this repo: `README.md` (phase-by-phase build log), `DESIGN.md` (visual design rationale), `DEPLOYMENT.md` (condensed deploy runbook — this document's Part 3 supersedes it with more detail).

---

# Part 1 — How It Was Made

## 1.1 What this is

A single-tenant, multi-branch CRM for a visa consultancy, covering the
full client journey: **Lead → Client → Case (visa processing) →
Admissions (education) → Documents → Communication**, with AI assistance
layered on top and a read-only API for a future client-facing chatbot.

It was built as 17 sequential phases, each one reviewed and approved
before the next began. Two phases deviated from the original plan by
explicit instruction: **Finance was dropped entirely** (no payment
handling in scope), and **the Client Portal became a read-only API**
instead of a web UI (to support a future AI chatbot rather than
duplicate what staff already do).

## 1.2 Technology stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | Server-rendered where useful, fully typed, utility CSS matches the design token system |
| Backend | FastAPI + Python, async throughout | Async ORM access end-to-end (SQLAlchemy 2.0 async), automatic OpenAPI docs |
| Database | PostgreSQL | Relational integrity across a genuinely relational domain (leads → clients → cases → documents) |
| Cache | Redis | Permission-lookup caching (Phase 15) and rate limiting (Phase 17) |
| Object storage | Cloudflare R2 (S3-compatible) | Presigned upload/download URLs — file bytes never touch the API server |
| AI | OpenRouter (model-agnostic) | One provider seam; swapping models is a config change |
| Email | Resend | Transactional email for the Communication module |
| OCR | Tesseract | Local, no per-page cloud OCR cost |

## 1.3 Architectural philosophy: modular monolith

One deployable backend, one deployable frontend — but internally
partitioned so that a module can be reasoned about, tested, and in
principle disabled without understanding the whole system.

**The rule that made this possible:** *a business module may only read
another business module's data through that module's `public.py` file.*
Never through direct model imports, never through its internal service
class. This was established in Phase 5 (Clients needing Leads data) and
held for the rest of the build — by Phase 12, one feature (AI cover
letter generation) needed to read from *two* other modules' `public.py`
files in a single request, and the pattern held without modification.

Two deliberate, documented exceptions:
- **`app/core/deps.py`** (`get_current_user`, `require_permission`) is
  allowed to know about Users/Roles/Permissions models directly, because
  resolving "who is making this request" is infrastructure, not business
  logic.
- **Core Platform services** (Workflow Engine, File Service,
  Communications, Notifications) are callable directly by any module,
  not gated behind a `public.py` — they're generic infrastructure a
  business module composes with, not another business module's private
  data.

## 1.4 The four patterns that repeat everywhere

If you understand these four things, you understand most of the
codebase — they were established early and deliberately reused rather
than reinvented per module.

**1. Public interfaces (`app/modules/<name>/public.py`)**
The sanctioned cross-module door. Each one is small and read-only:
`leads/public.py` exposes exactly `get_convertible_lead()` and a
branch-count aggregator; `clients/public.py` exposes name/eligibility
lookups plus one deliberately fuller `get_own_profile()` (see §1.6).
Nothing else in a module is importable from outside it.

**2. Ownership scoping (`view` vs `view_all`)**
Every business module's list/get endpoints follow the same shape: a
`<module>.view` permission shows only records assigned to you; a
`<module>.view_all` permission (granted to managers/CEO) shows
everything. The check is always: superuser → allow; `view_all` in
permissions → allow; else compare the record's owner field to
`current_user.id`. This exact shape appears in Leads, Clients, Cases,
and Admissions.

**3. The Workflow Engine, reused four times**
Built once in Phase 2 as a completely generic state machine
(`WorkflowDefinition` → `WorkflowStage` → `WorkflowTransition`, applied
to any `(entity_type, entity_id)` via `WorkflowInstance`). No business
module has its own pipeline logic in Python — Leads, Cases, and
Admissions each just seed *data* describing their stages and
transitions:

| Module | Workflow key | Stages |
|---|---|---|
| Leads | `lead_pipeline` | New → Contacted → Qualified → Proposal Sent → Converted / Lost |
| Cases | `visa_case_pipeline` | Consultation → Document Collection → Eligibility Review → Application → Submission → Biometrics → Medical → Interview → Decision → Post Visa Support / Closed Unsuccessful |
| Admissions | `admissions_pipeline` | Preparing Application → Submitted → Offer Received → Deposit Paid → Document Issued → Completed / Closed Unsuccessful |

Phase 13 (Reports) added a generic `get_stage_counts()` to the engine
itself — every pipeline got a funnel report for free, with zero
Reports-side knowledge of what a "lead" or "case" is.

**4. Generic entity attachment (`entity_type` + `entity_id`)**
Files, Communications, and Workflow instances all attach to *any*
record via a string type + string id pair rather than a foreign key per
entity type. This is why Documents and Communication panels needed zero
backend changes to support a fourth entity type (Admissions, Phase 10)
or a client's own profile (Phase 14) — the pattern was generic from day
one.

## 1.5 Module map

**Core Platform** (infrastructure, used by everything):
Auth · Permission Engine · User Management · Branch Management ·
Notifications · Activity & Audit Logs · Workflow Engine · File Service ·
AI Service

**Business modules** (the actual product):
Leads → Clients → Cases → Documents (built into File Service) →
Consultant/Visa-Processing/Admissions Portals → Admissions → AI Platform →
Reports & Analytics → Communication → Client Self-Service API

**11 staff/client roles**, seeded from day one:
CEO, Branch Manager, Sales, Consultant, Documentation Officer, Visa
Processing Officer, Admissions Officer, Finance, Marketing, Reception,
Client — with **48 fine-grained permissions** across them (e.g.
`leads.view`, `leads.view_all`, `cases.update`, `files.verify`,
`reports.view`, `client_portal.view_own`).

## 1.6 Notable, deliberate design decisions

- **Admissions has no link to Case.** Both depend only on Clients. A
  case↔admissions relationship (an offer letter feeding case
  eligibility) was left for a future phase rather than built
  speculatively.
- **Reaching `post_visa_support` does not close a case.** Only
  `close_unsuccessful` sets `is_closed = True` — post-visa support is
  modeled as ongoing, not an ending. Flagged as worth revisiting once
  that stage has real functionality.
- **`get_own_profile()` is the one function in the codebase that
  returns passport details** through a `public.py` — because its only
  legitimate caller is the client themself, via the read-only API.
  Every other cross-module read deliberately omits sensitive fields.
- **Two documented authorization simplifications**: file downloads are
  gated by (uploader OR `files.verify` OR superuser) rather than a full
  case-team ACL; Communications authorization is a flat permission
  rather than a per-entity ownership check. Both were judged not worth
  the cross-module coupling they'd require, and both are written down
  in the code, not just in this document.
- **Document/knowledge search is ILIKE, not Meilisearch**, despite
  Meilisearch being in the original tech stack. A real search index was
  judged premature without production data volume to justify it.

## 1.7 What each phase actually added

| Phase | Delivered |
|---|---|
| 1 | Project foundation: module registry pattern, DB base mixins, Docker Compose |
| 2 | Core Platform: Auth (JWT + rotating refresh tokens), RBAC, Users, Branches, Notifications, Activity/Audit Logs, Workflow Engine, File Service, AI Service |
| 3 | Design system: navy/paper/brass token palette, Fraunces/Inter/IBM Plex Mono type, the "stamp badge" signature component, `AppShell`/`SidebarNav` |
| 4 | Leads (first business module, first Workflow Engine reuse, ownership scoping pattern established) |
| 5 | Clients (first `public.py` cross-module interface) |
| 6 | Cases (the master pipeline, second `public.py` consumer, generated case references) |
| 7 | Document Management: folders, categories, version chaining, OCR, AI document analysis, expiry tracking |
| 8 | Consultant Portal — first role-specific home route, per-role routing infrastructure |
| 9 | Visa Processing Portal — a team queue (not personal ownership), zero backend changes needed |
| 10 | Admissions — fourth business module, confirmed the personal-caseload guess against real permission grants before building |
| 11 | Communication — one timeline for email + internal notes, reused across all four entity types |
| 12 | AI Platform — SOP/cover-letter generation, missing-document detection, client summaries, visa pathway suggestions (with mandatory disclaimer), internal knowledge search; ownership checks extended to AI endpoints |
| 13 | Reports & Analytics — funnels, branch performance, document compliance, all via count-only aggregation, zero direct cross-module model access |
| 14 | Client Self-Service API — read-only `/me/*` endpoints for a future chatbot, no UI, no write routes at all |
| 15 | Performance: missing indexes audited and added, a real N+1 fix (batch stage/name lookups), Redis actually used for the first time (permission caching), pagination on the four heaviest list endpoints |
| 16 | Testing: 55 tests across 12 files, transaction-per-test isolation, external services mocked at their seams, CI wired to Postgres+Redis service containers |
| 17 | Production deployment: structured logging actually configured, rate limiting actually built, production Dockerfile, Railway/Vercel configs, CD pipeline, deployment runbook |

---

# Part 2 — How It Can Be Further Improved

Organized by priority. "Near-term" items are the honest gaps flagged
throughout the build log — each was a deliberate scope call, not an
oversight, but each is also a real limitation worth knowing about
before relying on this in production.

## 2.1 Near-term (do before real production load)

1. **Generate and commit the first Alembic migration.** Every phase
   noted this honestly: this sandbox never had a reachable Postgres
   instance, so `alembic/versions/` is empty. This is the single most
   important thing to do before anything else — run
   `alembic revision --autogenerate` against a real dev database and
   commit the result.
2. **Frontend test coverage.** Zero tests exist across 51 frontend
   files, 8 business-module UIs, and 3 role portals. Phase 16 stayed
   backend-only by deliberate choice (business logic and permission
   boundaries live there) — but a regression in, say, the ownership
   check on a detail page wouldn't be caught by anything today.
3. **Bootstrap the first CEO user properly.** Right now this requires a
   one-off script run via database/shell access (`DEPLOYMENT.md` §2
   step 5) because `POST /users` itself requires `users.create`, which
   nobody has on a fresh install. A `scripts/bootstrap_admin.py` CLI
   command would remove the manual-shell-access requirement.
4. **Load testing.** Phase 15's performance work (indexes, N+1 fixes,
   caching, pagination) is reasoned about from first principles, not
   validated against real traffic. Worth a k6/Locust pass before
   assuming it holds up.
5. **File download authorization.** Currently: uploader, or anyone with
   `files.verify`, or superuser. A real case-team ACL (only the case's
   assigned consultant + relevant reviewers) was deferred as a coupling
   problem not worth solving speculatively — but it's a real gap if
   `files.verify` ends up granted broadly.

## 2.2 Mid-term (real features, not hardening)

6. **A genuine Meilisearch-backed global/document search.** Three
   separate phases (7, 12, 13) used pragmatic ILIKE queries as a
   stand-in for the Meilisearch integration in the original tech stack.
   This works today but won't scale in relevance or speed as document
   volume grows.
7. **Link Cases and Admissions.** An offer letter secured through
   Admissions is often the exact evidence a Case's Eligibility Review
   stage needs. Right now a consultant has to manually cross-reference
   both; a `case_id` field on `AdmissionApplication` (read via a new
   `cases/public.py` function, following the established pattern) would
   close this.
8. **Staff workload reporting, surfaced.** `get_case_counts_by_consultant()`
   was built in Phase 13 but never wired into the Reports UI — it needs
   consultant name resolution via Users to be readable, which felt like
   more scope than that pass needed. The backend half already exists.
9. **A real case-team communication ACL**, replacing the flat
   `communication.view`/`communication.send` permission from Phase 11,
   if/when Communications' current scope (every staff member with the
   permission sees every entity's messages) becomes a real problem.
10. **Post Visa Support as a real stage**, not just "doesn't close the
    case." Could carry its own sub-checklist (visa renewal reminders,
    check-in schedule) rather than being a placeholder terminal-ish
    stage.
11. **Bulk/CSV import** for leads and clients — every consultancy
    migrating from a spreadsheet or another CRM will want this, and
    nothing in the current build supports it.

## 2.3 Longer-term / architectural

12. **Multi-tenancy**, if this ever needs to serve more than one
    consultancy. The current design is explicitly single-tenant (per
    the original brief) — branches are *within* one company, not
    separate customers. Retrofitting multi-tenancy later would touch
    nearly every table (a `tenant_id` column and query scope, at
    minimum).
13. **Event-driven module communication.** Right now, one module calling
    another's `public.py` function is a direct, synchronous call. As the
    module count grows, an internal event bus (module A publishes
    "case_stage_changed", module B subscribes) would reduce direct
    coupling further and enable things like "notify Finance when a case
    reaches Decision" without Cases needing to import a Finance module
    that doesn't exist. Not needed yet — 12 modules is not a lot — but
    worth planning for before it is.
14. **Observability**: no error tracking (Sentry), no log aggregation
    beyond Railway's own viewer, no uptime monitoring, no APM. All
    reasonable to skip pre-launch, all worth adding within the first
    month of real traffic.
15. **Rate limiting beyond login.** Phase 17 protected the classic
    brute-force target specifically. A production deployment fronted by
    a real CDN would typically add broader per-IP limiting at that
    layer; the application-level limiter here doesn't attempt to
    replace that.
16. **Client Self-Service API → chatbot integration.** The read-only
    `/me/*` API (Phase 14) was built *for* a future chatbot but the
    chatbot itself doesn't exist yet. When it's built, decide whether it
    authenticates as a `client`-role user via the existing JWT flow, or
    whether a separate service-to-service API key scheme is worth adding
    — the current design supports either without rework.

## 2.4 Suggested order of operations

If picking this back up, roughly: (1) generate the real migration and
deploy to a real staging environment — this will surface issues no
amount of local reasoning can; (2) frontend tests, at least for the
permission-gated UI paths; (3) staff workload reporting (small, backend
already done); (4) Case↔Admissions link; (5) everything else, driven by
actual user feedback rather than this list's ordering.

---

# Part 3 — Deployment Steps

This expands on `DEPLOYMENT.md` with more context on *why*, not just
*what*. If you just need the commands, `DEPLOYMENT.md` is the faster
read; this section is for understanding the reasoning well enough to
adapt it if your setup differs.

## 3.1 Before you start: accounts needed

| Service | What it's for | Required? |
|---|---|---|
| Railway | Backend hosting + Postgres + Redis | Yes |
| Vercel | Frontend hosting | Yes |
| Cloudflare R2 | Document storage | Yes — File Service won't work without it |
| Resend | Transactional email | Yes — Communication module's email channel needs it |
| OpenRouter | AI features | Yes — AI Platform won't work without it, but the rest of the app functions fine if this is added later |
| Meilisearch | — | **Not currently used by anything.** Skip unless you're building the real search integration from §2.2.6 |

## 3.2 Backend deployment (Railway)

**Step 1 — Provision the data layer.**
Create a Railway project, add the **Postgres** plugin and the **Redis**
plugin. Both give you connection strings immediately — note the exact
format Railway provides and adapt to the env var format below
(`postgresql+asyncpg://...` for Postgres, since the app uses SQLAlchemy's
async driver).

**Step 2 — Deploy the backend service.**
Point a new Railway service at this repo's `backend/` directory.
Railway will find `backend/Dockerfile` and `backend/railway.json`
automatically. The Dockerfile is a multi-stage build — dependencies
compile in a builder stage with `gcc`/`libpq-dev`, then only the
compiled artifacts and `tesseract-ocr`/`libpq5` (runtime-only) ship in
the final image, running as a non-root user under `gunicorn` with 4
`uvicorn` workers.

**Step 3 — Environment variables.** Set on the Railway backend service:

```
ENVIRONMENT=production
DEBUG=false
JWT_SECRET_KEY=<generate a long random value - never reuse .env.example's>
DATABASE_URL=<from Railway's Postgres plugin>
REDIS_URL=<from Railway's Redis plugin>
CORS_ORIGINS=["https://your-app.vercel.app"]
R2_ACCOUNT_ID=<Cloudflare>
R2_ACCESS_KEY_ID=<Cloudflare>
R2_SECRET_ACCESS_KEY=<Cloudflare>
R2_BUCKET_NAME=<Cloudflare>
R2_ENDPOINT_URL=<Cloudflare>
OPENROUTER_API_KEY=<OpenRouter>
RESEND_API_KEY=<Resend>
RESEND_FROM_EMAIL=<a verified sender on your Resend domain>
```

`ENVIRONMENT=production` is what flips structured logging from
human-readable console output to JSON (`app/core/logging.py`) — this
is the format a log viewer actually wants to parse.

**Step 4 — First deploy, then run once:**
```bash
# Via Railway's shell/exec into the running service:
alembic revision --autogenerate -m "initial schema"   # first time only
alembic upgrade head
python -m scripts.seed   # roles, permissions, all 3 workflow pipelines, document categories
```

**Step 5 — Bootstrap the first user.**
There is deliberately no public registration endpoint, and `POST /users`
itself requires `users.create` — which nobody has on a brand-new
install. Until a bootstrap script exists (see §2.1.3), create the first
CEO manually via a one-off Python shell against the running container:
```python
from app.modules.users.models import User
from app.modules.permissions.models import Role
from app.core.security import hash_password
# fetch the seeded 'ceo' Role, construct a User with is_superuser=True, commit.
```

**Step 6 — Confirm readiness.**
`GET /api/v1/health/ready` should return
`{"status": "ok", "database": "connected"}`. This endpoint actually
queries Postgres — point your orchestrator's health check here, not at
`/api/v1/health` (which is a pure liveness check, intentionally DB-free
so it can't false-negative on a slow query).

## 3.3 Frontend deployment (Vercel)

**Step 1** — Import this repo into Vercel with root directory
`frontend/`. `vercel.json` declares the Next.js framework preset
explicitly.

**Step 2** — Set `NEXT_PUBLIC_API_BASE_URL` to your Railway backend's
public URL plus `/api/v1`, e.g.:
```
NEXT_PUBLIC_API_BASE_URL=https://your-backend.up.railway.app/api/v1
```

**Step 3** — Deploy. Vercel's own GitHub integration handles
auto-deploy on push to `main` — no custom CI/CD workflow was written
for the frontend (unlike the backend, which has one; see §3.4).

**Step 4** — Smoke-test login end to end. A `CORS_ORIGINS` mismatch on
the backend is the single most common first-deploy failure, and it
shows up as an opaque browser console CORS error, not a helpful
backend-side message — check this first if login silently fails.

## 3.4 CI/CD already in place

- **`.github/workflows/backend-tests.yml`** — runs the full 55-test
  suite against real Postgres + Redis service containers, on every push
  or PR touching `backend/`. Also declares `workflow_call`, so it can be
  reused rather than duplicated.
- **`.github/workflows/deploy-backend.yml`** — on push to `main`,
  re-runs the same test suite as a required check, then deploys to
  Railway via the Railway CLI. Requires a `RAILWAY_TOKEN` repository
  secret (generate one from Railway's project settings).

## 3.5 Rollback

Both platforms keep every previous deploy and make rollback a
dashboard action, not a redeploy: Railway's Deployments tab, Vercel's
Deployments tab — both support instant promotion of a prior build.

## 3.6 Observability — what exists and what doesn't

**Exists**: structured JSON logs to stdout, captured by Railway's log
viewer, with one line per request (method, path, status, duration,
client IP) via `app/core/request_logging.py`.

**Doesn't exist**: error tracking (Sentry or similar), log aggregation
beyond Railway's own viewer, uptime/synthetic monitoring, APM/tracing.
None of these are hard to add on top of what's here — because logs are
already structured, shipping them to an aggregator later is a
configuration change, not a rewrite — but none should be assumed to be
in place today.

## 3.7 Post-deploy checklist

- [ ] `/api/v1/health/ready` returns `database: connected`
- [ ] First CEO user created and can log in
- [ ] Login rate limiting confirmed working (11th rapid attempt from
      one IP+email within 5 minutes returns 429)
- [ ] A test document upload → verify → download round-trip succeeds
      (confirms R2 credentials are correct)
- [ ] A test email send succeeds (confirms Resend domain verification)
- [ ] Frontend can reach the backend with no CORS errors in the browser
      console
- [ ] `RAILWAY_TOKEN` secret set in GitHub, confirmed by a push to `main`
      triggering a successful deploy workflow run
