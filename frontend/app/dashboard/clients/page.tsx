"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { Client } from "@/lib/types/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function ClientsContent() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    authedApiClient
      .get<Client[]>("/clients/")
      .then(setClients)
      .catch(() => setError("Could not load clients."));
  }, []);

  const visibleClients = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? clients.filter((c) =>
          [c.full_name, c.email, c.phone, c.nationality, c.passport_number]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(q))
        )
      : clients;

    const sorted = [...filtered];
    if (sort === "newest") sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === "oldest") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (sort === "name_asc") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return sorted;
  }, [clients, search, sort]);

  function handleExport() {
    exportToCsv(
      "clients",
      visibleClients.map((c) => ({
        name: c.full_name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        nationality: c.nationality ?? "",
        passport_number: c.passport_number ?? "",
        status: c.is_active ? "active" : "inactive",
        created_at: c.created_at,
      }))
    );
  }

  return (
    <AppShell title="Clients">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">Clients</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Onboarded clients, converted from leads or added directly.
          </p>
        </div>
        <Link href="/dashboard/clients/new">
          <Button>New client</Button>
        </Link>
      </div>

      {clients && clients.length > 0 && (
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, email, phone, passport..."
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

      {error && <p className="text-sm text-signal-rejected">{error}</p>}

      {clients && clients.length === 0 && (
        <EmptyState
          title="No clients yet"
          description="Convert a lead from the Leads pipeline, or add a client directly."
          action={
            <Link href="/dashboard/clients/new">
              <Button size="sm">New client</Button>
            </Link>
          }
        />
      )}

      {clients && clients.length > 0 && visibleClients.length === 0 && (
        <p className="text-sm text-ink-muted">No clients match &quot;{search}&quot;.</p>
      )}

      {visibleClients.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Nationality</TableHeaderCell>
              <TableHeaderCell>Passport</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleClients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link href={`/dashboard/clients/${client.id}`} className="font-medium text-ink hover:underline">
                    {client.full_name}
                  </Link>
                  {client.email && <p className="text-xs text-ink-muted">{client.email}</p>}
                </TableCell>
                <TableCell className="text-ink-muted">{client.nationality ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs text-ink-muted">
                  {client.passport_number ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge tone={client.is_active ? "approved" : "neutral"}>
                    {client.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AppShell>
  );
}

export default function ClientsPage() {
  return (
    <ProtectedRoute>
      <ClientsContent />
    </ProtectedRoute>
  );
}
