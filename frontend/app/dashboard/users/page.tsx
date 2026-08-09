"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { User } from "@/lib/types/user";
import { Role } from "@/lib/types/role";
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

function UsersContent() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedApiClient
      .get<User[]>("/users/")
      .then(setUsers)
      .catch(() => setError("Could not load users."));

    // Role/branch names aren't included on the user record, so we look
    // them up client-side. Both calls fail silently to "—" labels if the
    // viewer lacks roles.manage / branches.view.
    authedApiClient.get<Role[]>("/permissions/roles").then(setRoles).catch(() => {});
    authedApiClient.get<Branch[]>("/branches/").then(setBranches).catch(() => {});
  }, []);

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";
  const branchName = (id: string | null) => (id ? branches.find((b) => b.id === id)?.name ?? "—" : "—");
  const additionalRoleNames = (u: User) =>
    u.additional_role_ids.map((id) => roles.find((r) => r.id === id)?.name).filter(Boolean) as string[];

  return (
    <AppShell title="Users">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">Users</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Team members with access to the platform.</p>
        </div>
        {hasPermission("users.create") && (
          <Link href="/dashboard/users/new">
            <Button>New user</Button>
          </Link>
        )}
      </div>

      {users && users.length > 0 && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              exportToCsv(
                "users",
                users.map((u) => ({
                  name: u.full_name,
                  email: u.email,
                  role: roleName(u.role_id),
                  branch: branchName(u.branch_id),
                  status: u.is_active ? "active" : "inactive",
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

      {users && users.length === 0 && (
        <EmptyState
          title="No users yet"
          description="Add a team member to give them access to the platform."
          action={
            hasPermission("users.create") ? (
              <Link href="/dashboard/users/new">
                <Button size="sm">New user</Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {users && users.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Branch</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/dashboard/users/${u.id}`} className="font-medium text-ink hover:underline">
                    {u.full_name}
                  </Link>
                  <p className="text-xs text-ink-muted">{u.email}</p>
                </TableCell>
                <TableCell className="text-ink-muted">
                  {roleName(u.role_id)}
                  {additionalRoleNames(u).length > 0 && (
                    <span className="ml-1 text-xs">(+{additionalRoleNames(u).join(", ")})</span>
                  )}
                </TableCell>
                <TableCell className="text-ink-muted">{branchName(u.branch_id)}</TableCell>
                <TableCell>
                  <Badge tone={u.is_active ? "approved" : "neutral"}>
                    {u.is_active ? "Active" : "Inactive"}
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

export default function UsersPage() {
  return (
    <ProtectedRoute>
      <UsersContent />
    </ProtectedRoute>
  );
}
