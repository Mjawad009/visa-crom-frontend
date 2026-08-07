"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { getHomeRoute } from "@/lib/role-routes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StampBadge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Roles with a dedicated portal (see lib/role-routes.ts) belong there,
    // not on the general admin dashboard — send them along if they land
    // here directly (bookmark, back button, etc).
    if (user) {
      const home = getHomeRoute(user.role_key);
      if (home !== "/dashboard") router.replace(home);
    }
  }, [user, router]);

  return (
    <AppShell title="Dashboard">
      <div className="mb-6">
        <h2 className="font-display text-xl font-medium text-ink">
          Welcome back, {user?.full_name?.split(" ")[0]}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Here's what's moving across the consultancy today.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Your role</p>
            <p className="mt-1 font-display text-lg text-ink capitalize">
              {user?.role_key.replace(/_/g, " ")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Permissions granted</p>
            <p className="mt-1 font-display text-lg text-ink">{user?.permissions.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Modules live</p>
            <p className="mt-1 font-display text-lg text-ink">12 / 27</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sample workflow — illustrative data</CardTitle>
          <CardDescription>
            Real case data now lives at /dashboard/cases (Phase 6). This table stays as a design-system reference.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table className="border-0 rounded-none">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Reference</TableHeaderCell>
                <TableHeaderCell>Client</TableHeaderCell>
                <TableHeaderCell>Stage</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs">VC-2026-0142</TableCell>
                <TableCell>A. Okafor</TableCell>
                <TableCell><StampBadge tone="pending">Document Collection</StampBadge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">VC-2026-0139</TableCell>
                <TableCell>R. Singh</TableCell>
                <TableCell><StampBadge tone="info">Submitted</StampBadge></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">VC-2026-0131</TableCell>
                <TableCell>M. Alvarez</TableCell>
                <TableCell><StampBadge tone="approved">Decision — Approved</StampBadge></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
