"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Lead, stageTone } from "@/lib/types/lead";
import { User } from "@/lib/types/user";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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

type SortKey = "newest" | "oldest" | "name_asc";

function LeadsContent() {
  const { hasPermission } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const canBulkAssign = hasPermission("leads.view_all") && hasPermission("leads.update");

  function load() {
    authedApiClient
      .get<Lead[]>("/leads/")
      .then(setLeads)
      .catch(() => setError("Could not load leads."));
  }

  useEffect(() => {
    load();
    if (canBulkAssign) authedApiClient.get<User[]>("/users/").then(setUsers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleLeads = useMemo(() => {
    if (!leads) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? leads.filter((l) =>
          [l.full_name, l.email, l.phone, l.country_of_interest, l.visa_type_interest]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(q))
        )
      : leads;

    const sorted = [...filtered];
    if (sort === "newest") sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (sort === "name_asc") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return sorted;
  }, [leads, search, sort]);

  function handleExport() {
    exportToCsv(
      "leads",
      visibleLeads.map((l) => ({
        name: l.full_name,
        email: l.email ?? "",
        phone: l.phone ?? "",
        source: l.source,
        country_of_interest: l.country_of_interest ?? "",
        visa_type_interest: l.visa_type_interest ?? "",
        stage: l.current_stage_name ?? "",
        created_at: l.created_at,
      }))
    );
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === visibleLeads.length ? new Set() : new Set(visibleLeads.map((l) => l.id))));
  }

  async function handleBulkAssign() {
    if (!bulkAssignTo || selected.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.allSettled(
        Array.from(selected).map((id) =>
          authedApiClient.patch(`/leads/${id}`, { assigned_to_user_id: bulkAssignTo })
        )
      );
      setSelected(new Set());
      setBulkAssignTo("");
      load();
    } finally {
      setBulkBusy(false);
    }
  }

  function handleExportSelected() {
    exportToCsv(
      "leads-selected",
      visibleLeads
        .filter((l) => selected.has(l.id))
        .map((l) => ({ name: l.full_name, email: l.email ?? "", phone: l.phone ?? "", stage: l.current_stage_name ?? "" }))
    );
  }

  return (
    <AppShell title="Leads">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">Leads</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Prospective clients moving through the lead pipeline.
          </p>
        </div>
        <Link href="/dashboard/leads/new">
          <Button>New lead</Button>
        </Link>
      </div>

      {leads && leads.length > 0 && (
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, email, phone, interest..."
          sortValue={sort}
          onSortChange={(v) => setSort(v as SortKey)}
          sortOptions={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "name_asc", label: "Name A–Z" },
          ]}
          onExport={handleExport}
        />
      )}

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-line bg-paper px-3 py-2">
          <span className="text-sm text-ink">{selected.size} selected</span>
          {canBulkAssign && (
            <>
              <Select value={bulkAssignTo} onChange={(e) => setBulkAssignTo(e.target.value)} className="w-auto">
                <option value="">Assign to...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </Select>
              <Button size="sm" disabled={!bulkAssignTo || bulkBusy} onClick={handleBulkAssign}>
                {bulkBusy ? "Assigning..." : "Assign"}
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={handleExportSelected}>
            Export selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">
            Clear
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-signal-rejected">{error}</p>}

      {leads && leads.length === 0 && (
        <EmptyState
          title="No leads yet"
          description="Create your first lead to start the pipeline."
          action={
            <Link href="/dashboard/leads/new">
              <Button size="sm">New lead</Button>
            </Link>
          }
        />
      )}

      {leads && leads.length > 0 && visibleLeads.length === 0 && (
        <p className="text-sm text-ink-muted">No leads match &quot;{search}&quot;.</p>
      )}

      {visibleLeads.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell className="w-8">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-line"
                  checked={selected.size === visibleLeads.length}
                  onChange={toggleSelectAll}
                />
              </TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Source</TableHeaderCell>
              <TableHeaderCell>Interest</TableHeaderCell>
              <TableHeaderCell>Stage</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleLeads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-line"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleSelected(lead.id)}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/dashboard/leads/${lead.id}`} className="font-medium text-ink hover:underline">
                    {lead.full_name}
                  </Link>
                  {lead.email && <p className="text-xs text-ink-muted">{lead.email}</p>}
                </TableCell>
                <TableCell className="capitalize text-ink-muted">{lead.source.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-ink-muted">
                  {[lead.country_of_interest, lead.visa_type_interest].filter(Boolean).join(" — ") || "—"}
                </TableCell>
                <TableCell>
                  <StampBadge tone={stageTone(lead.current_stage_key)}>
                    {lead.current_stage_name ?? "Unknown"}
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

export default function LeadsPage() {
  return (
    <ProtectedRoute>
      <LeadsContent />
    </ProtectedRoute>
  );
}
