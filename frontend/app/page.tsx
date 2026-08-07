import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink">
        Visa Consultancy CRM
      </h1>
      <p className="max-w-md text-center text-sm text-ink-muted">
        Core platform (auth, RBAC, workflow engine, file service, AI
        service) and the design system are live. Business modules
        (Leads, Clients, Cases, ...) begin in Phase 4.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-light"
        >
          Sign in
        </Link>
        <Link
          href="/design-system"
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
        >
          Design system
        </Link>
      </div>
    </main>
  );
}
