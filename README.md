# Visa Consultancy CRM — Phase 1: Project Foundation

Internal, single-tenant CRM for a multi-branch visa consultancy. Built as a
**modular monolith** — one deployable backend, one deployable frontend,
strict internal module boundaries.

## What's in this phase

Only the skeleton that every later phase depends on. No business logic,
no auth, no RBAC yet — those are Phase 2.

```
visa-crm/
├── backend/
│   ├── app/
│   │   ├── core/            # config, module registry (cross-cutting only)
│   │   ├── db/               # base models, session/engine
│   │   ├── modules/          # business + core-platform modules live here (empty for now)
│   │   ├── shared/            # cross-module services (event bus, etc. — future)
│   │   └── main.py            # thin FastAPI entrypoint
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── app/                   # Next.js App Router
│   ├── lib/api-client.ts      # single seam for all backend calls
│   └── package.json
└── docker-compose.yml          # postgres, redis, meilisearch, backend, frontend
```

## Key architecture decisions

**Module registry (`app/core/module_registry.py`)** — every business module
(Leads, Clients, Cases, Finance, ...) will expose one `Module` descriptor
with its own router and permissions. `main.py` never imports a module by
name; it loops over `ENABLED_MODULES`. Disabling a module is a one-line
config change, not a code change.

**DB base mixins (`app/db/base.py`)** — `UUIDPrimaryKeyMixin`,
`TimestampMixin`, `SoftDeleteMixin`, `BranchScopedMixin` are shared so every
module's models get audit fields and branch-scoping consistently, without
each module reinventing it.

**Single API client (`frontend/lib/api-client.ts`)** — every portal (CEO,
Sales, Consultant, Client, ...) will call the backend through this one
wrapper, so auth headers and error handling live in exactly one place.

**Config (`app/core/config.py`)** — every external dependency (Postgres,
Redis, R2, Meilisearch, OpenRouter, Resend) is an env var behind one
`Settings` object. Nothing reads `os.environ` directly elsewhere.

## Running locally

```bash
cp backend/.env.example backend/.env   # fill in secrets
docker compose up --build
```

Backend health check: `GET http://localhost:8000/api/v1/health`
Frontend: `http://localhost:3000`

## Phase 2 — Core Platform (this phase)

Nine modules, all wired through the Phase 1 module registry:

| Module | Key endpoints | Notes |
|---|---|---|
| Auth | `POST /auth/login`, `/refresh`, `/logout`, `GET /auth/me` | Rotating, individually-revocable refresh tokens (`refresh_tokens` table stores only the `jti`, never the raw token) |
| Permission Engine | `GET /permissions/roles`, `/permissions/permissions`, `PUT /permissions/roles/{id}/permissions` | 11 system roles seeded (`app/modules/permissions/seed.py`); `require_permission("key")` guards every protected route |
| User Management | `GET/POST/PATCH /users` | Role/branch/status changes go to the audit log, not just the activity log |
| Branch Management | `GET/POST/PATCH /branches` | |
| Notifications | `GET /notifications`, `POST /notifications/{id}/read` | In-app inbox; optional email via Resend (`app/shared/email.py`) |
| Activity & Audit Logs | `GET /logs/activity`, `GET /logs/audit` | Every module writes through `app/shared/activity.py` / `app/shared/audit.py` — never the tables directly |
| Workflow Engine | `POST /workflow/definitions`, `POST /workflow/instances`, `POST /workflow/instances/{id}/transition` | Fully data-driven: stages/transitions are rows, not code. Leads/Cases/Visa Processing will all reuse this in later phases |
| File Service | `POST /files/upload-url`, `GET /files/{id}/download-url`, `POST /files/{id}/verify` | Presigned R2 URLs — file bytes never touch our API server |
| AI Service | `POST /ai/chat` | Thin OpenRouter wrapper (`app/shared/ai_service.py`); capability-specific generators (SOP, cover letter, ...) arrive in Phase 13 |

### Key architecture decisions

**`app/core/deps.py`** is the one deliberate exception to "modules never
import each other" — `get_current_user` / `require_permission` need to
resolve identity across Auth + Users + Permissions, so that cross-cutting
concern lives in core, not inside any one module.

**Refresh token rotation**: every `/auth/refresh` call revokes the old
token and issues a new pair. A leaked, already-used refresh token is
useless to an attacker.

**Workflow Engine is generic on purpose**: it doesn't know what a "Lead"
or a "Case" is — it just tracks `(entity_type, entity_id)` through
stages. This is what lets Phase 4's Leads module and Phase 9's Visa
Processing module share one engine instead of each building their own
state machine.

**File Service issues presigned URLs, not proxied uploads**: keeps the
API server stateless and avoids streaming large files through FastAPI.

### Running Phase 2 locally

```bash
docker compose up --build            # postgres, redis, meilisearch, backend, frontend
cd backend && alembic revision --autogenerate -m "phase 2 core platform"
alembic upgrade head
python -m scripts.seed                # seeds roles + permissions
```

Then create a first CEO user directly in the DB (or via a one-off script)
to bootstrap login, since `POST /users` itself requires `users.create`.

### Not yet built in this phase

- Alembic's first migration file itself — this sandbox has no database/
  network access to run `alembic revision --autogenerate` against a real
  Postgres, so `alembic/versions/` is empty. Run the command above once
  you have a reachable `DATABASE_URL`.
- Full Document Management (folders, OCR, AI analysis, expiry tracking) —
  Phase 7 builds on today's File Service.
- Role-based portal UI — Phase 3 (Design System).

## Phase 3 — Design System (this phase)

See `DESIGN.md` for the full rationale (palette, type, and the signature
"stamp badge" component). Summary:

- **Tokens**: `frontend/tailwind.config.ts` — navy/paper/brass palette,
  Fraunces + Inter + IBM Plex Mono, small-radius enterprise scale.
- **Base components** (`components/ui/`): Button, Card, Badge +
  `StampBadge` (signature element, tied to the Workflow Engine's stages),
  Input/Label, Table, Avatar, EmptyState.
- **Layout shells** (`components/layout/`): `SidebarNav` (filters items
  by `hasPermission()`, ready for every future role portal),
  `Topbar`, `AppShell`.
- **Showcase**: visit `/design-system` after `npm run dev` to see every
  token and component rendered together.
- Login and Dashboard pages were rebuilt on top of the new system as the
  first real usage.

## Phase 4 — Leads (this phase)

The first Business Module, and the first real test of Phase 2's Workflow
Engine and Phase 3's design system working together end to end.

- **Model** (`app/modules/leads/models.py`): deliberately thin — contact
  facts and source only. Pipeline position is *not* a column on Lead; it
  lives entirely in a `WorkflowInstance` (Phase 2), proving the engine is
  reusable rather than leads-specific.
- **Pipeline**: seeded via `app/modules/leads/seed.py` as a
  `lead_pipeline` WorkflowDefinition — New → Contacted → Qualified →
  Proposal Sent → Converted / Lost — entirely data, zero hardcoded stage
  logic in Python.
- **Ownership scoping**: `leads.view` sees only leads assigned to you;
  `leads.view_all` (Branch Manager, Marketing, CEO) sees everything. This
  is the pattern every future module (Cases, Finance, ...) will reuse.
- **Permissions added**: `leads.view`, `leads.view_all`, `leads.create`,
  `leads.update`, `leads.convert` — granted to Sales, Marketing,
  Reception, Consultant, Branch Manager, and CEO by default (see updated
  `app/modules/permissions/seed.py`).
- **API**: `GET/POST /leads`, `PATCH /leads/{id}`, `POST /leads/{id}/transition`.
- **Frontend**: `/dashboard/leads` (list), `/dashboard/leads/new` (create
  form), `/dashboard/leads/[id]` (detail + stage-transition actions,
  using the Phase 3 `StampBadge` for the current stage).

### Known simplification

The lead detail page's available-transitions list is a small hardcoded
map (`frontend/lib/types/lead.ts`) mirroring the seeded pipeline, rather
than querying the Workflow Engine live. A generic "list valid transitions
for this instance" endpoint would remove the duplication — worth adding
once a second module needs the same thing, rather than building it
speculatively for one caller.

### Running Phase 4

After the Phase 2 migration/seed steps:
```bash
python -m scripts.seed   # now also seeds lead_pipeline
```

## Phase 5 — Clients (this phase)

The second Business Module, and the first genuine module-to-module
dependency: Clients needs data from Leads. Rather than importing Leads'
model or service directly, this phase establishes the pattern the spec
calls for — **modules communicate only through a published public
interface**:

- **`app/modules/leads/public.py`** — the only thing any other module is
  allowed to import from Leads. Exposes exactly one function,
  `get_convertible_lead()`, which enforces the business rule (a Client
  can only be created from a lead that reached the `converted` stage)
  without Clients needing to know anything about how the Lead pipeline
  works. Leads has zero awareness Clients exists — the dependency only
  points one way.
- **Model** (`app/modules/clients/models.py`): thin, like Lead. Case
  progress and document checklists belong to Cases (Phase 6) and
  Documents (Phase 7), not here.
- **Ownership scoping**: same pattern as Leads — `clients.view` sees only
  your assigned clients, `clients.view_all` sees everything.
- **Deactivation** is its own permission (`clients.deactivate`), separate
  from `clients.update`, and writes to the **audit log** rather than the
  activity log — deactivating a client record is the kind of change
  compliance may need to reconstruct later.
- **API**: `GET/POST /clients`, `PATCH /clients/{id}`.
- **Frontend**: `/dashboard/clients` (list), `/dashboard/clients/new`
  (supports `?fromLead=<id>` prefill), `/dashboard/clients/[id]` (detail
  + deactivate action, gated by `hasPermission`). The Lead detail page
  now shows a "Create client record" button once a lead reaches
  `converted`.

### Running Phase 5

No new seed data this phase — Clients has no workflow of its own.

## Phase 6 — Cases (this phase)

The module the master spec's real pipeline is for, and the third
module-to-module boundary — Cases reads Client data through
`app/modules/clients/public.py` (added this phase, same pattern as
Leads'), never Clients' models directly.

- **Pipeline**: seeded via `app/modules/cases/seed.py` as the
  `visa_case_pipeline` WorkflowDefinition — Consultation → Document
  Collection → Eligibility Review → Application → Submission →
  Biometrics → Medical → Interview → Decision → Post Visa Support,
  exactly as listed in the master spec, entirely as data. A case can be
  closed unsuccessful from any active stage via a `close_unsuccessful`
  transition reused across stages, same trick as Leads' `mark_lost`.
- **Design call**: reaching `post_visa_support` does **not** mark
  `is_closed` — that stage is meant to be ongoing support, not an
  ending. Only `closed_unsuccessful` sets `is_closed=True`. Worth
  revisiting once Post Visa Support has its own real workflow.
- **Reference numbers**: generated server-side (`VC-{year}-{4 digits}`),
  retried on collision — no dedicated sequence table needed at this
  scale.
- **Model**: thin, same discipline as Lead/Client — no status column.
  Branch/consultant default from the client record if not explicitly set
  at case creation.
- **Ownership scoping**: same pattern — `cases.view` (own),
  `cases.view_all` (Branch Manager, Documentation/Visa
  Processing/Admissions Officers, Finance, CEO).
- **API**: `GET/POST /cases`, `PATCH /cases/{id}`, `POST /cases/{id}/transition`.
- **Frontend**: `/dashboard/cases` (list), `/dashboard/cases/new`
  (requires `?clientId=`), `/dashboard/cases/[id]` (detail + stage
  actions). Client detail page now shows real linked cases and a "Start
  new case" button, replacing the Phase 5 placeholder.

### Running Phase 6

```bash
python -m scripts.seed   # now also seeds visa_case_pipeline
```

## Phase 7 — Document Management (this phase)

Built as an extension of the File Service (Phase 2) rather than a new
module — documents are files with more structure around them, not a
different kind of object. `FileRecord` gained version chaining, OCR
text, AI analysis, and rejection reasons; two new tables
(`DocumentFolder`, `DocumentCategory`) were added alongside it.

- **Folders & categories**: `document_folders` (self-referencing, scoped
  to one entity) and `document_categories` (seeded reference data —
  passport, bank statement, IELTS certificate, ..., each with its own
  `expiry_tracking_enabled` flag).
- **Version history**: uploading a new version of an existing document
  (`POST /files/{id}/new-version`) creates a new `FileRecord` linked via
  `previous_version_id` and marks the old one `superseded` — nothing is
  overwritten or lost.
- **OCR**: `app/shared/ocr.py`, a thin seam over Tesseract. Images
  (JPEG/PNG/TIFF/WEBP) are fully supported. PDF OCR needs
  poppler/pdf2image, which isn't in the base Dockerfile yet — the
  function raises a clear `OCRUnsupportedError` rather than silently
  returning empty text.
- **AI analysis**: `app/shared/document_ai.py`, built entirely on the
  Phase 2 AI Service — detects document type, extracts key fields,
  flags issues (blurry, expired, mismatched name), all via one
  `chat_json` call. Swapping the underlying model touches zero code here.
- **Approval workflow**: unchanged from Phase 2 (`pending` → `verified`/
  `rejected`), now with a stored `rejection_reason`.
- **Expiry tracking**: `GET /files/expiring?within_days=30` for staff
  with `files.verify`.
- **Search**: `GET /files/search?q=` — a pragmatic ILIKE query across
  filename/category/OCR text. Full Meilisearch-backed *global* search
  (a Core Platform item from the original spec) is still pending; this
  covers document search specifically without blocking Phase 7 on
  standing up a search cluster.
- **Known simplification — download access**: granted to the uploader,
  anyone with `files.verify`, or a superuser. A full case-team ACL
  (only the case's assigned consultant + reviewers) is deferred —
  documented in `app/modules/files/routes.py`.
- **Frontend**: `components/documents/documents-panel.tsx`, a reusable
  panel (upload with direct-to-R2 presigned PUT, verify/reject, "Run
  OCR + AI", download) embedded in both the Case and Client detail pages.

### Running Phase 7

```bash
python -m scripts.seed   # now also seeds document categories
```
Tesseract must be installed on the backend host — already in the
Dockerfile (`apt-get install tesseract-ocr`).

## Phase 8 — Consultant Portal (this phase)

The master spec's promise — "after authentication, users enter their own
portal based on their assigned role" — starts being realized here. Up to
now every role landed on the same generic `/dashboard`. Phase 8 adds
per-role home routing and the first dedicated portal.

- **`lib/role-routes.ts`**: a single `ROLE_HOME_ROUTES` map from role key
  to home route. Consultant → `/portal/consultant`; every other role
  still uses `/dashboard` until its own portal phase ships (Visa
  Processing — Phase 9, Admissions — Phase 10, Client Portal — Phase 15).
  Adding a new portal later is a one-line addition here, not a rewrite.
- **Login now routes by role**: `auth-context`'s `login()` returns the
  freshly-fetched user so the login page can redirect immediately, no
  extra round trip. The generic dashboard also redirects roles that have
  a dedicated portal, in case someone lands there via a bookmark.
- **Sidebar "Dashboard" link is role-aware** — points at whatever
  `getHomeRoute()` resolves to, so navigation stays consistent wherever
  a role's home actually is.
- **Consultant Portal** (`/portal/consultant`): a workspace view, not an
  admin list — open-lead count, active-client count, cases-in-progress
  count, a horizontally-scrolling **case pipeline board** (cases grouped
  by current workflow stage, Kanban-style), and a "leads needing
  attention" list. All pulled from the existing `leads.view` /
  `clients.view` / `cases.view` endpoints (already correctly scoped to
  "own" for a Consultant since Phase 4/6) — no new list endpoints needed.
- **Small backend addition**: `clients/public.py` gained
  `get_client_display_name()` — a looser lookup than
  `get_active_client()` (no active-status check) used purely so case
  cards can show the client's name. Never used to authorize anything,
  only to label a UI card — kept explicitly separate from the
  eligibility-check function so the two purposes can't be confused later.

### Running Phase 8

No new seed data or migrations — this phase is entirely routing +
aggregation of data that already existed.

## Phase 9 — Visa Processing Portal (this phase)

The second dedicated role portal, and a deliberately different shape
from the Consultant Portal — this one's a **shared team queue**, not a
personal "my work" view.

- **Why the shape differs**: Visa Processing Officers have
  `cases.view_all` (granted since Phase 6), and in practice this stage of
  work is staffed as a team against a shared queue, not assigned
  1:1 like Leads/Clients/early-stage Cases are. So `/portal/visa-processing`
  shows *every* case company-wide currently at Submission, Biometrics,
  Medical, Interview, or Decision — not just the logged-in officer's own.
- **Inline actions**: each case card in the queue renders its available
  transitions (via the same `availableCaseTransitions()` map from Phase
  6) as buttons directly in the queue — no need to open the case detail
  page just to advance or close it.
- **Urgency sorting**: within each stage, cases sort by
  `target_submission_date` ascending; anything under 3 days (or already
  past) is flagged in red.
- **Expiring documents watchlist**: reuses `GET /files/expiring` from
  Phase 7 directly — no new backend endpoint needed for this phase at all.
- **Known simplification**: stage filtering happens client-side after
  fetching the full case list, same pattern flagged in Phase 6/8. Worth
  promoting to a real `?stage=` query param on `GET /cases` if case
  volume ever makes fetching everything impractical — noted inline in
  the portal's `load()` function rather than built speculatively now.
- Role routing: `visa_processing_officer` added to
  `lib/role-routes.ts` — the whole point of that map from Phase 8.

### Running Phase 9

No backend changes this phase — entirely a new frontend view over
existing Cases (Phase 6) and Files (Phase 7) endpoints.

## Phase 10 — Admissions (this phase)

The fourth business module and the third role portal — and the guess
from the end of Phase 9 (personal caseload, not a team queue) was
checked against the actual permission model before building, not
assumed: `admissions_officer` got no existing `admissions.*` grants yet,
so this phase designed `admissions.view` (own) as the default and
confirmed the guess by granting it to the role rather than
`admissions.view_all`.

- **Model** (`app/modules/admissions/models.py`): tracks a client's
  application to a specific institution/program — deliberately **not**
  linked to Case. Both Admissions and Cases depend only on Clients (via
  the same public-interface pattern from Phase 5/6), avoiding a direct
  case↔admissions coupling neither module needs yet. If a future phase
  needs that link (e.g. an offer letter feeding case eligibility
  review), it's one field and one read from a `cases/public.py` —
  not a redesign.
- **Pipeline**: `admissions_pipeline` — Preparing Application → Submitted
  to Institution → Offer Received → Deposit Paid → Document Issued
  (CAS/I-20) → Completed, plus `close_unsuccessful` from any active
  stage. Fourth reuse of the Phase 2 Workflow Engine (after Leads,
  Cases) with zero new engine code.
- **Ownership scoping**: `admissions.view` (own) vs `admissions.view_all`
  (Branch Manager, Documentation Officer, CEO) — same pattern as every
  other module.
- **Documents**: applications get the full `DocumentsPanel` from Phase 7
  via `entity_type="admission"` — no changes needed to the File Service
  at all to support a fourth entity type.
- **API**: `GET/POST /admissions`, `PATCH /admissions/{id}`,
  `POST /admissions/{id}/transition`.
- **Frontend**: `/dashboard/admissions` (admin list, for those with
  `view_all`), `/dashboard/admissions/new` (requires `?clientId=`),
  `/dashboard/admissions/[id]` (detail + transitions + documents). Client
  detail page now shows both Cases and Admissions side by side, each
  with its own "start" button.
- **Admissions Portal** (`/portal/admissions`): personal caseload,
  Kanban-by-stage — structurally almost identical to the Consultant
  Portal (Phase 8), which is exactly what confirming the ownership-model
  guess implied it should be.

### Running Phase 10

```bash
python -m scripts.seed   # now also seeds admissions_pipeline
```

## Phase 11 — Communication (this phase, renumbered — Finance dropped)

The user confirmed the consultancy won't handle payments, so **Finance
is out of scope entirely** — not stubbed, not deferred, just removed
from the plan. Phases renumbered accordingly (Communication moves from
Phase 12 to 11; AI Platform, Reports & Analytics, Client Portal, and the
hardening phases all shift up by one).

- **Model**: `CommunicationLog` — one timeline for both outbound emails
  and internal notes, generic across `(entity_type, entity_id)` exactly
  like Files (Phase 2/7). Reused the pattern rather than building a
  parallel one.
- **Email** goes out via `app/shared/email.py` (Resend, Phase 2) — this
  phase added zero new email-provider code, just a caller. Send happens
  *before* the log commit, so a delivery failure surfaces to the user
  instead of silently recording a message that never sent.
- **Internal notes** never leave the system — same table, `direction="internal"`,
  no email dispatch.
- **Known simplification** (documented in `communications/models.py`):
  authorization is a flat `communication.view` / `communication.send`
  permission, not a per-entity ownership check against whatever module
  owns the `entity_type`. Enforcing "only this case's assigned
  consultant can see its emails" would mean Communications importing
  every business module's ownership rules — a bigger coupling problem
  than the gap is worth solving right now. Same category of tradeoff as
  the file-download ACL simplification from Phase 7.
- **Frontend**: `components/communications/communication-panel.tsx`,
  mirroring `DocumentsPanel`'s shape, now embedded on **all four**
  detail pages that exist so far — Lead, Client, Case, Admission.

### Running Phase 11

No new seed data or migrations beyond the new table — this phase adds
one model, one service, and one shared frontend panel.

## Phase 12 — AI Platform (this phase)

Every remaining AI capability from the master spec, all built on the
Phase 2 AI Service (`app/shared/ai_service.py`) — this phase adds zero
new AI-provider code, only prompts and the data plumbing to feed them.

- **SOP Generator** (`POST /ai/generate-sop`) and **Cover Letter
  Generator** (`POST /ai/generate-cover-letter`) — draft text pulling
  context from Clients (and optionally Admissions/Cases).
- **Missing Document Detection** (`POST /ai/missing-documents`) — a
  hybrid: deterministic set comparison (which `expiry_tracking_enabled`
  categories from Phase 7 aren't covered by verified/pending uploads)
  plus an AI-phrased, client-facing summary of the gap.
- **Client Summaries** (`POST /ai/client-summary`) — synthesizes recent
  communication history (Phase 11) into a handoff-ready summary.
- **Visa Pathway Suggestions** (`POST /ai/visa-pathway-suggestions`) —
  always returns a fixed disclaimer alongside the AI output: informational
  only, not legal advice, must be reviewed by a licensed consultant.
- **Internal Knowledge Search** (`POST /ai/knowledge-search`) — searches
  Files (OCR text) and Communications via the same pragmatic ILIKE
  approach as Phase 7's document search, then asks the model to
  synthesize an answer grounded only in what matched, returning sources
  alongside the answer. Same known simplification as Phase 7: not
  Meilisearch-backed semantic search.
- **New public interfaces**: `cases/public.py` and `admissions/public.py`
  — AI Platform is the first module that needed to read from *two*
  other modules' public interfaces in the same feature (a cover letter
  needs both Client and Case facts). `clients/public.py` also gained
  `get_client_ai_context()` — deliberately excludes passport number and
  other identifiers no generated document needs.
- **Ownership enforced properly**: every entity-referencing AI endpoint
  checks `view_all` OR ownership (assigned consultant/officer) before
  generating anything — the same pattern used everywhere else, applied
  here for the first time to AI endpoints specifically (Phase 2's
  original `/ai/chat` had no entity to check against, so this gap didn't
  exist until entity-aware AI features did).
- **Frontend**: `/dashboard/ai` (general chat + knowledge search) is
  finally a real page — the sidebar has linked here since Phase 3 with
  nothing behind it. `ClientAIPanel`, `CaseAIPanel`, and
  `AdmissionAIPanel` embed the entity-specific tools directly into their
  respective detail pages.

### Running Phase 12

No new seed data or migrations — this phase is entirely new endpoints
and prompts over data that already existed.

## Phase 13 — Reports & Analytics (this phase)

Deliberately touches no other module's models directly — this phase's
whole discipline is extending the *count-only* surface each module
already exposes, rather than reaching into anyone's tables.

- **Funnel reports** (leads/cases/admissions) use one new generic method,
  `WorkflowEngineService.get_stage_counts()` — added to the Core
  Platform Workflow Engine (Phase 2), not to Reports itself, so any
  future pipeline gets a funnel report for free.
- **Branch performance** and **document compliance** use narrow,
  count-only additions to each module's existing `public.py`
  (`get_lead_counts_by_branch`, `get_client_counts_by_branch`,
  `get_case_counts_by_branch`, `get_admission_counts_by_branch`) and to
  `FileService` (`get_status_counts`) — Reports never sees a lead's
  name, a client's passport number, or a case's notes, only numbers
  grouped by branch.
- **Staff workload** (`get_case_counts_by_consultant`) is wired in the
  service layer but not yet surfaced on the report page — the frontend
  would need to resolve consultant names via the Users module to make
  it readable, which felt like more scope than this pass needed. Noted
  here rather than half-built into the UI.
- **Permissions**: `reports.view`, granted to CEO, Branch Manager, and
  Finance (the Finance *role* still exists even though the Finance
  *module* was dropped — reports access is a reasonable read-only ask
  regardless).
- **Frontend**: `/dashboard/reports` — three funnel bar charts, a
  grouped bar chart for branch performance, and a document compliance
  panel. Added `recharts` as a real dependency this phase (previous
  phases had no chart library installed).

### Running Phase 13

No new seed data or migrations — this phase adds aggregation functions
and one new route module, nothing else.

## Phase 14 — Client Self-Service API (this phase, scope changed by request)

The original plan called for a full external-facing Client Portal UI.
That's been dropped by explicit decision: staff already handle document
upload/verify/delete from the internal side, so a client-facing web app
duplicating that isn't needed. Instead, this phase ships a **read-only
API** intended for a future AI chatbot to call on a client's behalf —
no write access from this surface, ever, and no frontend pages at all.

- **Linking a client to a login account**: `Client` gained a nullable,
  unique `user_id` FK. Most clients never get one — it's only set when
  staff want to give a specific client chatbot/self-service access.
  No new endpoint was needed for this: staff already create a `client`-role
  user via the existing `POST /users`, then link it via the existing
  `PATCH /clients/{id}` (which already accepted arbitrary field updates).
- **New module `client_api`**, mounted at `/api/v1/me/*` — reads that
  name intentionally ("my own data"). **Every route is GET.** There are
  no POST/PATCH/DELETE routes anywhere in this module, by design:
  - `GET /me/profile` — name, contact info, nationality, passport details
  - `GET /me/cases` — own cases with current pipeline stage
  - `GET /me/admissions` — own admission applications with current stage
  - `GET /me/documents` — own documents' status (superseded versions
    filtered out — clients see current versions only, not full history)
  - `GET /me/communications` — **outbound emails only**; internal staff
    notes are filtered out at the query level, never even considered
  - All permission-gated by a single new `client_portal.view_own`
    permission — the `client` role's first-ever grant (it had zero
    permissions since Phase 2, by design, until this phase gave it
    something to actually do).
- **New public-interface additions**: `get_client_id_for_user()` and
  `get_own_profile()` (Clients — the latter is the one function in this
  entire codebase that deliberately *does* return passport details,
  because its only legitimate caller is the client themself),
  `get_case_summaries_for_client()` (Cases), `get_admission_summaries_for_client()`
  (Admissions) — same public-interface discipline as every cross-module
  read so far.
- **Auth**: reuses the existing JWT infrastructure from Phase 2 —
  no separate chatbot-auth scheme was built. A `client`-role user (or
  whatever the chatbot authenticates as) logs in through the same
  `/auth/login` and calls `/me/*` with the same bearer token everything
  else uses. If a dedicated service-to-service API key scheme is wanted
  later for the chatbot specifically, that's an additive change, not a
  rework of this module.

### Running Phase 14

No new seed data. One new nullable column (`clients.user_id`) needs a
migration once there's a reachable database.

## Phase 15 — Performance Optimisation (this phase)

Four concrete, honest improvements — no vague "optimized X%" claims,
since there's no production traffic yet to actually measure.

1. **Missing indexes.** An audit found almost no explicit indexes beyond
   what `unique=True` gives for free. Added:
   - Composite `(entity_type, entity_id)` indexes on `WorkflowInstance`,
     `FileRecord`, `CommunicationLog`, `ActivityLog`, `AuditLog` — the
     single most common query shape in the whole system.
   - Single-column indexes on every ownership/branch FK actually filtered
     on in a `WHERE` clause: `Lead.assigned_to_user_id`/`branch_id`,
     `Client.assigned_consultant_id`/`branch_id`/`lead_id`,
     `Case.client_id`/`branch_id`/`assigned_consultant_id`,
     `Admission.client_id`/`branch_id`/`assigned_officer_id`,
     `RefreshToken.user_id`, `WorkflowInstanceHistory.instance_id`.

2. **A real N+1 fix.** `list_leads`/`list_cases`/`list_applications` were
   each calling a single-row workflow-stage lookup (and, for
   Cases/Admissions, a single-row client-name lookup) once per row — a
   page of 50 cases was 1 + 100 queries. Added
   `WorkflowEngineService.get_stages_for_entities()` (batch, one query)
   and `clients/public.get_client_display_names()` (batch, one query),
   and rewired all three list methods to use them. Same page is now 3
   queries total regardless of list size.

3. **Redis, actually used for the first time.** `REDIS_URL` has been
   configured since Phase 2's docker-compose; nothing ever read or wrote
   to it until now. `app/shared/cache.py` is a thin, fail-open wrapper
   (a cache outage degrades performance, never breaks a request). First
   consumer: `get_current_user`'s role→permissions lookup, a join query
   that ran on *every single authenticated request*. Cached per role_id
   with a 5-minute TTL, explicitly invalidated the moment
   `PermissionEngineService.set_role_permissions()` changes a role's
   grants — deliberately not caching the user row itself, so deactivating
   a user or changing their role still takes effect immediately.

4. **Pagination.** `GET /leads`, `/clients`, `/cases`, `/admissions` all
   gained `limit`/`offset` params (default 100, hard-capped at 200
   server-side regardless of what's requested) — the four list endpoints
   most likely to return unbounded result sets in production.

### What this phase did *not* do

No caching of list responses, no read replicas, no query result
memoization beyond the one permissions cache — those would be
premature without real traffic patterns to profile against. Worth
revisiting once there's production usage data.

## Phase 16 — Testing (this phase)

55 tests across 12 files, plus CI to actually run them. Every test
requires a real Postgres + Redis (this sandbox has neither) — the CI
workflow (`.github/workflows/backend-tests.yml`) spins both up as
service containers and runs the full suite on every push/PR touching
`backend/`.

- **Fixtures** (`app/tests/conftest.py`): transaction-per-test isolation
  — each test runs inside a savepoint that's rolled back at teardown, so
  the schema is created once per session and tests never see each
  other's data. A `client` fixture overrides `get_db` to hand every
  request the test's own session; a `make_user()` helper and
  `auth_headers()` (issuing a real JWT directly, skipping the login
  round trip for tests that aren't specifically testing login) keep
  individual tests short.
- **External services are mocked at the shared/ seam** — the same seam
  that makes R2/Tesseract/OpenRouter/Resend swappable in production is
  what makes them mockable here. No test hits real cloud storage, OCR,
  an LLM API, or sends a real email.
- **What's actually covered**: auth (login/refresh-rotation/logout/
  inactive-user rejection), the permission engine (deny/allow/superuser-
  bypass/cache-invalidation-on-grant-change — directly testing the Phase
  15 Redis change didn't silently break "permission edits take effect
  immediately"), the generic Workflow Engine in isolation (definition
  creation, transitions, invalid-transition rejection, the Phase 15
  batch stage-lookup matching single-lookup behavior), and per-module
  ownership scoping + business rules for Leads, Clients, Cases,
  Admissions, Files, Communications, Reports, the Client Self-Service
  API, and AI Platform's ownership checks.
- **A structural test, not just a behavioral one**:
  `test_me_routes_have_no_write_verbs` inspects the actual router object
  and asserts every method is GET — so if a future change accidentally
  adds a POST to `client_api`, this fails immediately rather than relying
  on someone noticing in review.
- **Known gap**: no frontend tests. The frontend has grown to 51 files
  across 8 business-module UIs plus 3 role portals with no test coverage
  at all. Given the choice between broadening backend coverage further
  or starting frontend testing from zero, this pass stayed backend-only
  — the business logic and permission boundaries live there, and that's
  where a regression would be most costly. Worth a dedicated pass later.

### Running the tests

```bash
docker compose up -d postgres redis
cd backend
alembic upgrade head   # once a migration exists — see Phase 2 note
pytest -v
```
Or just push to a branch — CI runs it the same way.

## Phase 17 — Production Deployment (this phase, final phase)

Two dependencies were configured but never actually used since the
phase they were introduced — same pattern as Redis before Phase 15.
This phase closed both gaps, plus real deployment configs for the
original tech stack (Railway backend, Vercel frontend).

- **Structured logging, finally used.** `structlog` has been in
  `requirements.txt` since Phase 1; nothing called `structlog.configure()`
  until now. `app/core/logging.py` sets it up — JSON output in
  production (what a log viewer actually wants), readable console
  output locally. `app/core/request_logging.py` adds one structured log
  line per request (method, path, status, duration, client IP).
- **Rate limiting, built for the first time.** Listed under the
  *original* master spec's Security requirements from message one, never
  implemented until this phase. `app/shared/rate_limit.py` is a Redis
  fixed-window counter (reusing the Phase 15 cache seam, not a new
  dependency) applied to `POST /auth/login`: 10 attempts per 5 minutes,
  keyed on IP+email together. Scoped honestly — this protects login
  specifically, not a blanket global rate limit on every route; a real
  reverse proxy/CDN in front of production would typically add broader
  protection at that layer.
- **Readiness check.** `/api/v1/health` stayed a pure liveness check
  (no DB touch, can't false-negative on a slow query); new
  `/api/v1/health/ready` actually queries Postgres — this is what an
  orchestrator's health check should point at before routing traffic to
  a new deploy.
- **Production Dockerfile**: multi-stage build (compiler toolchain never
  ships in the runtime image), non-root user, gunicorn managing uvicorn
  workers instead of the bare dev server. `docker-compose.yml` now
  overrides the command back to `uvicorn --reload` for local dev, so
  the Dockerfile's own `CMD` is what Railway actually runs in production.
- **Deployment configs**: `backend/railway.json`, `frontend/vercel.json`.
- **CD**: `.github/workflows/deploy-backend.yml` reruns the Phase 16
  test suite and only deploys to Railway on a green build. Vercel
  deploys the frontend via its own GitHub integration — no custom
  workflow needed there.
- **`DEPLOYMENT.md`** — a step-by-step runbook, not just a config
  reference: account setup, environment variable checklist, first-deploy
  migration/seed/bootstrap-CEO-user steps, rollback procedure, and an
  honest observability section (structured logs to stdout only — no
  Sentry/Datadog/uptime monitoring wired up, noted as reasonable future
  additions rather than pretended-done).

## Project status — all 17 phases complete

Finance was dropped entirely (payments out of scope, by request). The
Client Portal became a read-only API instead of a UI (by request, to
support a future chatbot). Every other phase from the original plan
shipped. Every honest gap along the way is flagged in this README rather
than papered over: no first Alembic migration (never had a reachable DB
in this sandbox), no Meilisearch-backed search (ILIKE stands in), no
frontend test coverage, no load testing, a handful of documented
ownership/ACL simplifications where full cross-module authorization
would have meant real architectural coupling for marginal benefit.

The thing worth trusting most about this codebase isn't any single
feature — it's that the same handful of patterns (public interfaces
between modules, ownership scoping via `view`/`view_all` pairs, the
Workflow Engine reused four times without new engine code, ownership
checks on AI endpoints, ILIKE search reused three times) show up
everywhere they should, because each new module was built by checking
what the last one did rather than improvising fresh each time.
