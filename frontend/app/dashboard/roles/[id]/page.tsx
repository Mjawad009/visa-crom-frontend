"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { Role, Permission, groupPermissionsByModule } from "@/lib/types/role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function RoleDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [roles, permissions, rolePermissions] = await Promise.all([
          authedApiClient.get<Role[]>("/permissions/roles"),
          authedApiClient.get<Permission[]>("/permissions/permissions"),
          authedApiClient.get<string[]>(`/permissions/roles/${params.id}/permissions`),
        ]);
        const found = roles.find((r) => r.id === params.id);
        if (!found) {
          setError("Role not found.");
          return;
        }
        setRole(found);
        setAllPermissions(permissions);
        setSelected(new Set(rolePermissions));
      } catch {
        setError("Could not load this role. You may not have permission to manage roles.");
      }
    }
    load();
  }, [params.id]);

  const grouped = useMemo(() => groupPermissionsByModule(allPermissions), [allPermissions]);

  function toggle(key: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await authedApiClient.put<string[]>(`/permissions/roles/${params.id}/permissions`, {
        permission_keys: Array.from(selected),
      });
      setSelected(new Set(updated));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await authedApiClient.delete(`/permissions/roles/${params.id}`);
      router.push("/dashboard/roles");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete this role.");
    }
  }

  if (error && !role) {
    return (
      <AppShell title="Role">
        <p className="text-sm text-signal-rejected">{error}</p>
      </AppShell>
    );
  }

  if (!role) {
    return (
      <AppShell title="Role">
        <p className="text-sm text-ink-muted">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={role.name}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">{role.name}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{role.description ?? "No description."}</p>
        </div>
        <Badge tone={role.is_system ? "info" : "neutral"}>{role.is_system ? "System role" : "Custom role"}</Badge>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([module, perms]) => (
          <Card key={module}>
            <CardHeader>
              <CardTitle className="capitalize">{module.replace(/_/g, " ")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 py-4">
              {perms.map((perm) => (
                <label key={perm.id} className="flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-paper">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-line"
                    checked={selected.has(perm.key)}
                    onChange={() => toggle(perm.key)}
                  />
                  <span>
                    <span className="block text-ink">{perm.key}</span>
                    {perm.description && <span className="block text-xs text-ink-muted">{perm.description}</span>}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-signal-rejected">{error}</p>}
      {saved && <p className="mt-4 text-sm text-signal-approved">Permissions saved.</p>}
      {deleteError && <p className="mt-4 text-sm text-signal-rejected">{deleteError}</p>}

      <div className="mt-5 flex justify-between gap-2">
        {!role.is_system ? (
          <ConfirmDialog
            title="Delete this role?"
            description={`"${role.name}" will be permanently removed. This only works if no one currently has it assigned — reassign anyone using it first.`}
            confirmLabel="Delete role"
            danger
            onConfirm={handleDelete}
            trigger={(open) => (
              <Button variant="danger" onClick={open}>
                Delete role
              </Button>
            )}
          />
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Back
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save permissions"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

export default function RoleDetailPage() {
  return (
    <ProtectedRoute>
      <RoleDetailContent />
    </ProtectedRoute>
  );
}
