# Design System — Rationale (Phase 3)

## Brief, as I read it

Internal, enterprise CRM for a visa consultancy. Users are staff (11
roles) plus an external client portal. Master spec calls for "premium
enterprise interface: fast, minimal, professional, accessible,
responsive, consistent," built on shadcn/ui conventions. This is not a
marketing site — the design's job is to make dense, high-stakes case
data (documents, deadlines, application stages) easy to scan and hard
to misread, across a full working day.

## Token plan

**Color** — grounded in the subject: official travel documents, seals,
ledgers.
- `ink` `#14203D` — deep navy, does the work near-black usually does in
  dark UI, but reads as "document cover" rather than generic dark-mode.
  Used for the sidebar and primary text.
- `paper` `#F5F7F9` — cool near-white app background. Deliberately not
  the warm cream (`~#F4F1EA`) that's become an AI-generated-design tell;
  shifted cooler so it reads as clean stationery, not a template default.
- `surface` `#FFFFFF` — cards and inputs sit above `paper`.
- `brass` `#A87C2A` — a single restrained accent, reserved for the stamp
  badge and primary actions. Evokes an official seal without literally
  drawing one.
- `signal-approved / pending / rejected / info` — case-stage semantics,
  desaturated enough to sit calmly in a dense table all day.

**Type** — three roles, none of them the default Inter-does-everything:
- **Fraunces** (display) — a serif with real character, used only for
  page titles and card headers. Gives the product an "official document"
  gravity without going decorative.
- **Inter** (UI/body) — carries the actual work: forms, tables, nav.
  Chosen for legibility at small sizes across a long workday, not for
  personality.
- **IBM Plex Mono** (data) — case references, IDs, timestamps. Monospace
  makes reference numbers scannable and unmistakably "data," not prose.

**Layout** — fixed navy sidebar (role-filtered nav) + light topbar +
paper content area. Small border radius (4–10px), 1px hairline borders,
generous but not spacious padding — enterprise data density, not startup
marketing spaciousness.

## Signature element: the Stamp Badge

Every case in this CRM moves through a workflow stage (Phase 2's
Workflow Engine). The **StampBadge** — a perforated-border, uppercase,
monospace pill — is the one place the design takes a visible risk: it
reads as a visa stamp or ticket stub, reserved *only* for workflow/status
states, so it stays meaningful (this record has been processed) instead
of decorative. Everything else in the system — buttons, cards, tables —
stays quiet and disciplined around it, per the "spend your boldness in
one place" principle.

## What was deliberately avoided

- Warm cream + terracotta (the most common AI-generated-design default).
- Near-black background + neon accent (the second most common default).
- Zero-radius "broadsheet" layout — not wrong for enterprise software,
  but not this brief's register either; a small radius reads calmer for
  case-management data.
- Decorative literalism (no clip-art passport stamps, no globe icons) —
  the subject shows up in structure and material choices, not illustration.

## Files

- `frontend/tailwind.config.ts` — token source of truth (colors, fonts, radius)
- `frontend/app/globals.css` — font variables wiring, perforation texture
- `frontend/components/ui/*` — Button, Card, Badge/StampBadge, Input,
  Table, Avatar, EmptyState
- `frontend/components/layout/*` — SidebarNav (permission-filtered),
  Topbar, AppShell
- `frontend/app/design-system/page.tsx` — living showcase of every token
  and component (visit `/design-system` after `npm run dev`)
