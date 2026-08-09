"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { User, UserUpdatePayload } from "@/lib/types/user";
import { Role } from "@/lib/types/role";
import { Branch } from "@/lib/types/branch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function UserDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState<UserUpdatePayload>({});
  const [additionalRoleIds, setAdditionalRoleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const canUpdate = hasPermission("users.update");

  async function load() {
    try {
      const data = await authedApiClient.get<User>(`/users/${params.id}`);
      setUser(data);
      setForm({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? "",
        role_id: data.role_id,
        branch_id: data.branch_id,
      });
      setAdditionalRoleIds(data.additional_role_ids);
    } catch {
      setError("Could not load this user.");
    }
  }

  useEffect(() => {
    load();
    authedApiClient.get<Role[]>("/permissions/roles").then(setRoles).catch(() => {});
    authedApiClient.get<Branch[]>("/branches/").then(setBranches).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await authedApiClient.patch<User>(`/users/${params.id}`, {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || undefined,
        role_id: form.role_id,
        branch_id: form.branch_id || null,
        additional_role_ids: additionalRoleIds,
      });
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await authedApiClient.patch<User>(`/users/${params.id}`, { is_active: !user.is_active });
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetting(true);
    setResetMessage(null);
    setError(null);
    try {
      await authedApiClient.post(`/users/${params.id}/reset-password`, { new_password: newPassword });
      setNewPassword("");
      setResetMessage("Password updated. Share the new password with them securely.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    } finally {
      setResetting(false);
    }
  }

  if (error && !user) {
    return (
      <AppShell title="User">
        <p className="text-sm text-signal-rejected">{error}</p>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="User">
        <p className="text-sm text-ink-muted">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={user.full_name}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">{user.full_name}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={user.is_active ? "approved" : "neutral"}>{user.is_active ? "Active" : "Inactive"}</Badge>
          {hasPermission("users.deactivate") && (
            user.is_active ? (
              <ConfirmDialog
                title="Deactivate this user?"
                description={`${user.full_name} will immediately lose access to the platform. Their records and activity history stay intact and this can be reversed anytime.`}
                confirmLabel="Deactivate"
                danger
                onConfirm={toggleActive}
                trigger={(open) => (
                  <Button variant="danger" size="sm" onClick={open} disabled={saving}>
                    {saving ? "Deactivating..." : "Deactivate"}
                  </Button>
                )}
              />
            ) : (
              <Button variant="secondary" size="sm" onClick={toggleActive} disabled={saving}>
                Reactivate
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full name</Label>
                <Input
                  disabled={!canUpdate}
                  value={form.full_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  disabled={!canUpdate}
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Phone</Label>
              <Input
                disabled={!canUpdate}
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Primary role</Label>
                <Select
                  disabled={!canUpdate}
                  value={form.role_id ?? ""}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, role_id: e.target.value }));
                    setAdditionalRoleIds((prev) => prev.filter((id) => id !== e.target.value));
                  }}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Branch</Label>
                <Select
                  disabled={!canUpdate}
                  value={form.branch_id ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                >
                  <option value="">No branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {roles.length > 1 && (
              <div>
                <Label>Additional roles</Label>
                <p className="mb-1.5 -mt-1 text-xs text-ink-muted">
                  Grants this person the permissions of more than one role.
                </p>
                <div className="space-y-1 rounded border border-line p-2">
                  {roles
                    .filter((r) => r.id !== form.role_id)
                    .map((role) => (
                      <label key={role.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-paper">
                        <input
                          type="checkbox"
                          disabled={!canUpdate}
                          className="h-3.5 w-3.5 rounded border-line"
                          checked={additionalRoleIds.includes(role.id)}
                          onChange={(e) =>
                            setAdditionalRoleIds((prev) =>
                              e.target.checked ? [...prev, role.id] : prev.filter((id) => id !== role.id)
                            )
                          }
                        />
                        {role.name}
                      </label>
                    ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-signal-rejected">{error}</p>}

            {canUpdate && (
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => router.back()}>
                  Back
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {canUpdate && (
          <Card>
            <CardHeader>
              <CardTitle>Reset password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <Label>New password</Label>
                  <Input
                    required
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <p className="text-xs text-ink-muted">
                  Sets their password directly — share it with them securely afterward.
                </p>
                {resetMessage && <p className="text-sm text-signal-approved">{resetMessage}</p>}
                <Button type="submit" size="sm" disabled={resetting} className="w-full">
                  {resetting ? "Updating..." : "Reset password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

export default function UserDetailPage() {
  return (
    <ProtectedRoute>
      <UserDetailContent />
    </ProtectedRoute>
  );
}
