"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { Case, caseStageTone } from "@/lib/types/case";
import { StampBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { exportToCsv } from "@/lib/csv-export";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

type SortKey = "newest" | "oldest" | "priority";
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function CasesContent() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    authedApiClient
      .get<Case[]>("/cases/")
      .then(setCases)
      .catch(() => setError("Could not load cases."));
  }, []);

  const visibleCases = useMemo(() => {
    if (!cases) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? cases.filter((c) =>
          [c.reference, c.client_full_name, c.destination_country, c.visa_type, c.case_type]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(q))
        )
      : cases;

    const sorted = [...filtered];
    if (sort === "newest") sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (sort === "priority") sorted.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
    return sorted;
  }, [cases, search, sort]);

  function handleExport() {
    exportToCsv(
      "cases",
      visibleCases.map((c) => ({
        reference: c.reference,
        client: c.client_full_name ?? "",
        case_type: c.case_type,
        destination_country: c.destination_country ?? "",
        visa_type: c.visa_type ?? "",
        priority: c.priority,
        stage: c.current_stage_name ?? "",
        created_at: c.created_at,
      }))
    );
  }

  return (
    <AppShell title="Cases">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">Cases</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Consultation through Post Visa Support, tracked end to end.
          </p>
        </div>
      </div>

      {cases && cases.length > 0 && (
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search reference, client, destination..."
          sortValue={sort}
          onSortChange={(v) => setSort(v as SortKey)}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "priority", label: "Priority" },
          ]}
          onExport={handleExport}
        />
      )}

      {error && <p className="text-sm text-signal-rejected">{error}</p>}

      {cases && cases.length === 0 && (
        <EmptyState
          title="No cases yet"
          description="Open a case from a client's profile to start the pipeline."
        />
      )}

      {cases && cases.length > 0 && visibleCases.length === 0 && (
        <p className="text-sm text-ink-muted">No cases match &quot;{search}&quot;.</p>
      )}

      {visibleCases.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Reference</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Destination</TableHeaderCell>
              <TableHeaderCell>Priority</TableHeaderCell>
              <TableHeaderCell>Stage</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleCases.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/dashboard/cases/${c.id}`} className="font-mono text-xs font-medium text-ink hover:underline">
                    {c.reference}
                  </Link>
                </TableCell>
                <TableCell className="capitalize text-ink-muted">{c.case_type.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-ink-muted">{c.destination_country ?? "—"}</TableCell>
                <TableCell className="capitalize text-ink-muted">{c.priority}</TableCell>
                <TableCell>
                  <StampBadge tone={caseStageTone(c.current_stage_key)}>
                    {c.current_stage_name ?? "Unknown"}
                  </StampBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AppShell>
  );
}

export default function CasesPage() {
  return (
    <ProtectedRoute>
      <CasesContent />
    </ProtectedRoute>
  );
}
