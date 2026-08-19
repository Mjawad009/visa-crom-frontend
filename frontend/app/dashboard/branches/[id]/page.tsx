"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Branch, BranchUpdatePayload } from "@/lib/types/branch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function BranchDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchUpdatePayload>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage = hasPermission("branches.manage");

  const [otherBranches, setOtherBranches] = useState<Branch[]>([]);
  const [reassignTo, setReassignTo] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignResult, setReassignResult] = useState<string | null>(null);

  async function load() {
    try {
      // The API only exposes list + patch for branches (no single-record
      // GET), so we pull the list and find this one.
      const all = await authedApiClient.get<Branch[]>("/branches/?include_inactive=true");
      const found = all.find((b) => b.id === params.id);
      if (!found) {
        setError("Branch not found.");
        return;
      }
      setBranch(found);
      setForm({ name: found.name, address: found.address ?? "", phone: found.phone ?? "", email: found.email ?? "" });
      setOtherBranches(all.filter((b) => b.id !== params.id && b.is_active));
    } catch {
      setError("Could not load this branch.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await authedApiClient.patch<Branch>(`/branches/${params.id}`, {
        name: form.name,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
      });
      setBranch(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!branch) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await authedApiClient.patch<Branch>(`/branches/${params.id}`, { is_active: !branch.is_active });
      setBranch(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReassign() {
    if (!reassignTo) return;
    setReassigning(true);
    setError(null);
    setReassignResult(null);
    try {
      const result = await authedApiClient.post<{ reassigned: Record<string, number> }>(
        `/branches/${params.id}/reassign-all?to_branch_id=${reassignTo}`,
        {}
      );
      const { users, leads, clients, cases } = result.reassigned;
      setReassignResult(`Moved ${users} users, ${leads} leads, ${clients} clients, ${cases} cases.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reassign records.");
    } finally {
      setReassigning(false);
    }
  }

  if (error && !branch) {
    return (
      <AppShell title="Branch">
        <p className="text-sm text-signal-rejected">{error}</p>
      </AppShell>
    );
  }

  if (!branch) {
    return (
      <AppShell title="Branch">
        <p className="text-sm text-ink-muted">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={branch.name}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">{branch.name}</h2>
          <p className="mt-0.5 font-mono text-xs text-ink-muted">{branch.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={branch.is_active ? "approved" : "neutral"}>{branch.is_active ? "Active" : "Inactive"}</Badge>
          {canManage && (
            branch.is_active ? (
              <ConfirmDialog
                title="Deactivate this branch?"
                description={`${branch.name} will be marked inactive. Staff and records tied to it stay intact, but it will drop out of new-user and new-record dropdowns until reactivated.`}
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

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          <div>
            <Label>Name</Label>
            <Input
              disabled={!canManage}
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <Label>Address</Label>
            <Input
              disabled={!canManage}
              value={form.address ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input
                disabled={!canManage}
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                disabled={!canManage}
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>

          {error && <p className="text-sm text-signal-rejected">{error}</p>}

          {canManage && (
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

      {canManage && branch.is_active && otherBranches.length > 0 && (
        <Card className="mt-4 max-w-xl">
          <CardHeader>
            <CardTitle>Reassign users & records</CardTitle>
            <CardDescription>
              Move every user, lead, client, and case currently pointed at this branch to another one — do this
              before deactivating so nothing gets stranded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Move everything to</Label>
                <Select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                  <option value="">Select a branch</option>
                  {otherBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </div>
              <Button size="sm" disabled={!reassignTo || reassigning} onClick={handleReassign}>
                {reassigning ? "Moving..." : "Reassign all"}
              </Button>
            </div>
            {reassignResult && <p className="text-sm text-signal-approved">{reassignResult}</p>}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

export default function BranchDetailPage() {
  return (
    <ProtectedRoute>
      <BranchDetailContent />
    </ProtectedRoute>
  );
}
