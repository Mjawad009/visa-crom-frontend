"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { User, UserCreatePayload } from "@/lib/types/user";
import { Role } from "@/lib/types/role";
import { Branch } from "@/lib/types/branch";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

function NewUserContent() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    role_id: "",
    branch_id: "",
  });
  const [additionalRoleIds, setAdditionalRoleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    authedApiClient.get<Role[]>("/permissions/roles").then((data) => {
      setRoles(data);
      setForm((f) => (f.role_id ? f : { ...f, role_id: data[0]?.id ?? "" }));
    }).catch(() => setError("Could not load roles — you may not have permission to assign them."));
    authedApiClient.get<Branch[]>("/branches/").then(setBranches).catch(() => {});
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: UserCreatePayload = {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || undefined,
        role_id: form.role_id,
        branch_id: form.branch_id || undefined,
        additional_role_ids: additionalRoleIds,
      };
      const user = await authedApiClient.post<User>("/users/", payload);
      router.push(`/dashboard/users/${user.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="New user">
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 py-5">
            <div>
              <Label>Full name</Label>
              <Input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Temporary password</Label>
              <Input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-muted">They can change this after their first login.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <Select
                  required
                  value={form.role_id}
                  onChange={(e) => {
                    update("role_id", e.target.value);
                    setAdditionalRoleIds((prev) => prev.filter((id) => id !== e.target.value));
                  }}
                >
                  <option value="" disabled>
                    Select a role
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={form.branch_id} onChange={(e) => update("branch_id", e.target.value)}>
                  <option value="">No branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-signal-rejected">{error}</p>}

            {roles.length > 1 && (
              <div>
                <Label>Additional roles</Label>
                <p className="mb-1.5 -mt-1 text-xs text-ink-muted">
                  Optional — grants this person the permissions of more than one role, e.g. a Consultant who also
                  covers Reception.
                </p>
                <div className="space-y-1 rounded border border-line p-2">
                  {roles
                    .filter((r) => r.id !== form.role_id)
                    .map((role) => (
                      <label key={role.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-paper">
                        <input
                          type="checkbox"
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

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !form.role_id}>
                {submitting ? "Creating..." : "Create user"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </AppShell>
  );
}

export default function NewUserPage() {
  return (
    <ProtectedRoute>
      <NewUserContent />
    </ProtectedRoute>
  );
}
