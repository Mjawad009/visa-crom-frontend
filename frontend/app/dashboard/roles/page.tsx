"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { Role } from "@/lib/types/role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

function RolesContent() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState({ key: "", name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    authedApiClient
      .get<Role[]>("/permissions/roles")
      .then(setRoles)
      .catch(() => setError("Could not load roles."));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const role = await authedApiClient.post<Role>("/permissions/roles", newRole);
      router.replace(`/dashboard/roles/${role.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create role.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Roles & Permissions">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">Roles & Permissions</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Open a role to see and edit what it can access across the platform.
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>{creating ? "Cancel" : "New role"}</Button>
      </div>

      {creating && (
        <Card className="mb-5 max-w-lg">
          <form onSubmit={handleCreate}>
            <CardContent className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Key</Label>
                  <Input
                    required
                    placeholder="e.g. senior_consultant"
                    value={newRole.key}
                    onChange={(e) => setNewRole((r) => ({ ...r, key: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Display name</Label>
                  <Input
                    required
                    placeholder="e.g. Senior Consultant"
                    value={newRole.name}
                    onChange={(e) => setNewRole((r) => ({ ...r, name: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={newRole.description} onChange={(e) => setNewRole((r) => ({ ...r, description: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-signal-rejected">{error}</p>}
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? "Creating..." : "Create role"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      )}

      {error && !creating && <p className="text-sm text-signal-rejected">{error}</p>}

      {roles && roles.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Key</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <Link href={`/dashboard/roles/${role.id}`} className="font-medium text-ink hover:underline">
                    {role.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-ink-muted">{role.key}</TableCell>
                <TableCell className="text-ink-muted">{role.description ?? "—"}</TableCell>
                <TableCell>
                  <Badge tone={role.is_system ? "info" : "neutral"}>{role.is_system ? "System" : "Custom"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AppShell>
  );
}

export default function RolesPage() {
  return (
    <ProtectedRoute>
      <RolesContent />
    </ProtectedRoute>
  );
}
