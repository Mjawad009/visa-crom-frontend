"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Branch } from "@/lib/types/branch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { exportToCsv } from "@/lib/csv-export";
import { Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

function BranchesContent() {
  const { hasPermission } = useAuth();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedApiClient
      .get<Branch[]>("/branches/?include_inactive=true")
      .then(setBranches)
      .catch(() => setError("Could not load branches."));
  }, []);

  return (
    <AppShell title="Branches">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">Branches</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Office locations this CRM operates across.</p>
        </div>
        {hasPermission("branches.manage") && (
          <Link href="/dashboard/branches/new">
            <Button>New branch</Button>
          </Link>
        )}
      </div>

      {branches && branches.length > 0 && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              exportToCsv(
                "branches",
                branches.map((b) => ({
                  name: b.name,
                  code: b.code,
                  address: b.address ?? "",
                  phone: b.phone ?? "",
                  email: b.email ?? "",
                  status: b.is_active ? "active" : "inactive",
                }))
              )
            }
          >
            <Download className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
            Export CSV
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-signal-rejected">{error}</p>}

      {branches && branches.length === 0 && (
        <EmptyState
          title="No branches yet"
          description="Add a branch to organize users, leads, and cases by location."
          action={
            hasPermission("branches.manage") ? (
              <Link href="/dashboard/branches/new">
                <Button size="sm">New branch</Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {branches && branches.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Contact</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>
                  <Link href={`/dashboard/branches/${branch.id}`} className="font-medium text-ink hover:underline">
                    {branch.name}
                  </Link>
                  {branch.address && <p className="text-xs text-ink-muted">{branch.address}</p>}
                </TableCell>
                <TableCell className="font-mono text-xs text-ink-muted">{branch.code}</TableCell>
                <TableCell className="text-ink-muted">{branch.phone ?? branch.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge tone={branch.is_active ? "approved" : "neutral"}>
                    {branch.is_active ? "Active" : "Inactive"}
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

export default function BranchesPage() {
  return (
    <ProtectedRoute>
      <BranchesContent />
    </ProtectedRoute>
  );
}
