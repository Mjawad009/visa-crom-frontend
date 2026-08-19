# Visa CRM — Changes in This Update

This document covers everything added or fixed since the original 17-phase build, in the order it was built. Each section says **what** changed, **why**, and **where to find it** in the codebase.

---

## 1. Missing admin pages (Users, Branches, Roles, Logs, Notifications)

**Problem:** The sidebar linked to `/dashboard/users`, `/dashboard/branches`, `/dashboard/roles`, `/dashboard/logs`, and `/dashboard/notifications`, but none of those page folders existed in the Next.js app — clicking them 404'd. The backend already had working APIs for all five; only the frontend pages were missing.

**What was built:**

| Page | Path | What it does |
|---|---|---|
| Users list/create/detail | `app/dashboard/users/` | List staff, create new accounts, edit role/branch/status |
| Branches list/create/detail | `app/dashboard/branches/` | List/create branches, edit details, activate/deactivate |
| Roles & Permissions | `app/dashboard/roles/` | List roles, edit a role's permission checklist grouped by module |
| Activity & Audit Logs | `app/dashboard/logs/` | Tabbed view of the activity feed and the before/after audit trail |
| Notifications | `app/dashboard/notifications/` | Inbox with read/unread filter, mark-as-read |

**Supporting changes:**
- Added `lib/types/{user,branch,role,log,notification}.ts` — frontend types matching the backend Pydantic schemas exactly.
- Added a `put()` method to `lib/api-client.ts` — it was missing, and the role-permissions endpoint needs it.
- Extended `lib/mock-data.ts` / `lib/mock-router.ts` so all five pages also work in `NEXT_PUBLIC_MOCK_MODE` (offline preview, no backend).
- Wired the topbar bell icon (previously inert) to link to Notifications with a live unread-count badge.

---

## 2. Tasks & Calendar (new module — backend "Phase 18")

**Problem:** No way to set reminders, follow-ups, or appointments anywhere in the CRM.

**Backend** — `backend/app/modules/tasks/`:
- `models.py` — `Task` table: title, type (`task`/`call`/`meeting`/`appointment`/`follow_up`), optional link to any other record (`entity_type` + `entity_id`, same generic pattern as Files/Communications), due date, status (`pending`/`completed`/`cancelled`), reminder settings, and recurrence.
- Ownership-scoped like every other module: `tasks.view` (your own) vs `tasks.view_all` (everyone's).
- **Reminders** (`backend/app/shared/reminders.py`): in-app and email reminders work today through the existing Notifications module. SMS/WhatsApp are accepted values that log a "would have sent" event and still create an in-app notification — nothing is silently dropped. Real Twilio integration is a one-file change (`TWILIO_*` settings already added to `app/core/config.py`, all optional/blank by default).
- **Recurrence**: `recurrence` field (`daily`/`weekly`/`monthly`) + `recurrence_until`. Completing a recurring task automatically creates the next occurrence (`TaskService.complete_task`), with correct month-length handling (e.g. the 31st rolling into February clamps to the 28th/29th, doesn't skip to March).
- `POST /tasks/dispatch-reminders` — endpoint for a future cron/scheduler to trigger due reminders (superuser-gated; not meant for a person to click).

**Frontend:**
- `/dashboard/tasks` — agenda view grouped by day, status filters (Upcoming/Completed/Cancelled/All), "My tasks / Everyone" toggle, inline Complete/Cancel.
- `/dashboard/tasks/new` — creation form with type, due date, recurrence picker, and reminder channel (SMS/WhatsApp marked "coming soon" in the UI).
- `components/tasks/tasks-panel.tsx` — a reusable panel embedded directly into **Lead, Client, Case, and Admission** detail pages, so a follow-up can be added right from a client's record.

---

## 3. Bug fixes from user testing

### 3a. Roles & Permissions page appeared inaccessible
**Root cause found:** `backend/app/core/deps.py` caches each role's permission list in Redis for 5 minutes. Startup permission-seeding (`seed_permissions`) runs as a fire-and-forget background task that does **not** block the server from accepting requests. If anyone logged in immediately after a fresh deploy/restart, the permission lookup could run *before* seeding finished, cache an **empty list**, and make even the CEO account look permission-less for up to 5 minutes.
**Fix:** empty permission results are no longer cached (every real role has at least one grant, so an empty result almost always means "seeding hasn't finished yet").

### 3b. No way to give a user multiple roles
**Fix:** added a `user_roles` many-to-many table (`backend/app/modules/users/models.py`) alongside the existing single `role_id` (kept as the "primary" role, used for portal routing). A user's effective permissions are now the union of their primary role plus any additional roles assigned. Both the New User and Edit User pages have a checklist for "Additional roles."

### 3c. Couldn't edit users after creation
Name/phone/role/branch editing already worked; **email editing and password reset were genuinely missing**. Added:
- Email is now editable (with a server-side uniqueness check).
- `POST /users/{id}/reset-password` — a "Reset password" panel on the user detail page for admin-initiated password resets.

### 3d. No edit options on Leads
Confirmed and fixed — added a full Edit toggle on the Lead detail page (name, email, phone, source, country/visa type of interest, assignment, notes). The backend already supported this (`PATCH /leads/{id}`); only the UI was missing.

---

## 4. Same fix applied to Clients, Cases, Admissions

The Leads edit-form bug was systemic — Clients, Cases, and Admissions detail pages had the same gap (only stage-transition buttons, no way to edit the underlying fields). Added the same Edit-toggle pattern to all three detail pages.

---

## 5. Confirmation dialogs for irreversible actions

Added a reusable `components/ui/confirm-dialog.tsx` and wired it into every "deactivate" or "delete" action that previously fired on a single click:
- Deactivating a branch
- Deactivating a user
- Deactivating a client
- Deleting a custom role

---

## 6. Search, sort, and CSV export on list pages

Added `components/ui/list-toolbar.tsx` (search box + sort dropdown + export button) and `lib/csv-export.ts` (client-side CSV generation — no backend round-trip needed since list pages already hold the full dataset in memory).

Applied to: Leads, Clients, Cases (search + sort + export), Users and Branches (export only).

---

## 7. Notifications: mark all as read

- Backend: `POST /notifications/read-all`.
- Frontend: "Mark all as read" button, only shown when there's something unread.

---

## 8. Roles & Permissions: create and delete

- `POST /permissions/roles` — create a custom role (key + display name + description).
- `DELETE /permissions/roles/{id}` — delete a role, blocked if it's a system role or still assigned to anyone (either as a primary or additional role).
- Frontend: "New role" form on the Roles list page, "Delete role" button on the role detail page.

---

## 9. Session handling

Rewrote `lib/auth-context.tsx`:
- **Remember me** checkbox on login — controls whether tokens are stored in `localStorage` (survives closing the browser) or `sessionStorage` (cleared on close, the safer default).
- **Session-expiry banner** (`components/layout/session-expiry-banner.tsx`) — appears 2 minutes before the access token expires (decoded client-side from the JWT's `exp` claim), with a "Stay signed in" button that silently refreshes via the existing `/auth/refresh` endpoint.

> **Note:** this changed where tokens are stored. Anyone with a session from before this update needs to log in again once — no data is lost, it's a one-time re-auth.

---

## 10. Bulk actions on Leads

Added checkbox selection to the Leads list: select individual rows or all visible rows, then bulk-assign the selection to a consultant (loops individual `PATCH /leads/{id}` calls client-side — no new backend endpoint needed at this scale) or export just the selected rows to CSV.

---

## 11. Drag-and-drop file upload with progress

Rebuilt `components/documents/documents-panel.tsx`:
- Drag-and-drop zone (click to browse still works too), multiple files at once.
- Real per-file progress bars — uses `XMLHttpRequest` instead of `fetch` for the actual storage upload specifically because `fetch` has no upload-progress event.

---

## 12. Mobile responsiveness (sidebar)

- `components/layout/sidebar-nav.tsx` is now a slide-in drawer below the `lg` breakpoint, with a hamburger button in the topbar (`components/layout/topbar.tsx`) and a tap-outside-to-close backdrop. Desktop is unaffected (sidebar stays static).
- Tables already scrolled horizontally on narrow screens — no change needed there.

---

## 13. Bulk branch reassignment

- `POST /branches/{id}/reassign-all?to_branch_id=...` — moves every user, lead, client, and case pointed at one branch over to another in a single transaction.
- Frontend: "Reassign users & records" card on the Branch detail page, meant to be used right before deactivating a branch so nothing gets stranded on a branch that's about to go inactive.

---

## What's still not built

Flagged but intentionally left for a future round:
- **Communication templates & attachments** — outbound emails/SMS have no saved-template picker or file attachments yet.
- **Per-user notification preferences** — no settings page for choosing which events trigger a notification.
- **Audit-log revert UI** — the audit trail is read-only; there's no "undo this change" button. This was skipped deliberately — safely reverting an arbitrary historical change (with cascading workflow/stage side effects) needs testing against a live database that wasn't available in this environment, and shipping it untested was judged riskier than not having it.
- **Recurring-task calendar grid** — Tasks & Calendar is an agenda/list view, not a true month-grid calendar with drag-to-reschedule.

## Also called out earlier as broader CRM gaps (unrelated to this round's fixes)

From the original gap analysis, still open: Finance/invoicing (explicitly out of scope by design), a client-facing portal UI (API-only today), full-text/semantic search (still ILIKE-based), PDF OCR (needs `poppler`/`pdf2image`, not installed), zero frontend test coverage, no error/uptime monitoring, and no first Alembic migration has ever been generated (the schema exists only as SQLAlchemy models until a real Postgres connection lets `alembic revision --autogenerate` produce one).
