"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Client } from "@/lib/types/client";
import { Case, caseStageTone } from "@/lib/types/case";
import { AdmissionApplication, admissionStageTone } from "@/lib/types/admission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StampBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { CommunicationPanel } from "@/components/communications/communication-panel";
import { TasksPanel } from "@/components/tasks/tasks-panel";
import { ClientAIPanel } from "@/components/ai/client-ai-panel";

function ClientDetailContent() {
  const params = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("clients.update");
  const [client, setClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    nationality: "",
    passport_number: "",
    passport_expiry: "",
    address: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await authedApiClient.get<Client>(`/clients/${params.id}`);
      setClient(data);
      setForm({
        full_name: data.full_name,
        email: data.email ?? "",
        phone: data.phone ?? "",
        date_of_birth: data.date_of_birth ?? "",
        nationality: data.nationality ?? "",
        passport_number: data.passport_number ?? "",
        passport_expiry: data.passport_expiry ?? "",
        address: data.address ?? "",
        notes: data.notes ?? "",
      });
      const [clientCases, clientAdmissions] = await Promise.all([
        authedApiClient.get<Case[]>(`/cases/?client_id=${params.id}`),
        authedApiClient.get<AdmissionApplication[]>(`/admissions/?client_id=${params.id}`).catch(() => []),
      ]);
      setCases(clientCases);
      setAdmissions(clientAdmissions);
    } catch {
      setError("Could not load this client.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleDeactivate() {
    setUpdating(true);
    try {
      const updated = await authedApiClient.patch<Client>(`/clients/${params.id}`, { is_active: false });
      setClient(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not deactivate this client.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleReactivate() {
    setUpdating(true);
    try {
      const updated = await authedApiClient.patch<Client>(`/clients/${params.id}`, { is_active: true });
      setClient(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reactivate this client.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await authedApiClient.patch<Client>(`/clients/${params.id}`, {
        full_name: form.full_name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        date_of_birth: form.date_of_birth || undefined,
        nationality: form.nationality || undefined,
        passport_number: form.passport_number || undefined,
        passport_expiry: form.passport_expiry || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
      });
      setClient(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !client) {
    return (
      <AppShell title="Client">
        <p className="text-sm text-signal-rejected">{error}</p>
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell title="Client">
        <p className="text-sm text-ink-muted">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={client.full_name}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">{client.full_name}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {client.email ?? "No email"} · {client.phone ?? "No phone"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={client.is_active ? "approved" : "neutral"}>
            {client.is_active ? "Active" : "Inactive"}
          </Badge>
          {canEdit && !editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>

          {!editing && (
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Nationality</p>
                <p className="mt-0.5 text-ink">{client.nationality ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Date of birth</p>
                <p className="mt-0.5 text-ink">{client.date_of_birth ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Passport number</p>
                <p className="mt-0.5 font-mono text-ink">{client.passport_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Passport expiry</p>
                <p className="mt-0.5 text-ink">{client.passport_expiry ?? "—"}</p>
              </div>
              {client.address && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Address</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-ink">{client.address}</p>
                </div>
              )}
              {client.notes && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notes</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-ink">{client.notes}</p>
                </div>
              )}
            </CardContent>
          )}

          {editing && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full name</Label>
                  <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Nationality</Label>
                  <Input value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date of birth</Label>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
                <div>
                  <Label>Passport number</Label>
                  <Input value={form.passport_number} onChange={(e) => setForm((f) => ({ ...f, passport_number: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Passport expiry</Label>
                  <Input type="date" value={form.passport_expiry} onChange={(e) => setForm((f) => ({ ...f, passport_expiry: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Textarea rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>

              {error && <p className="text-sm text-signal-rejected">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cases.length === 0 && (
              <p className="text-sm text-ink-muted">No cases opened yet.</p>
            )}
            {cases.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/cases/${c.id}`}
                className="flex items-center justify-between rounded border border-line px-3 py-2 hover:bg-paper"
              >
                <div>
                  <p className="font-mono text-xs font-medium text-ink">{c.reference}</p>
                  <p className="text-xs capitalize text-ink-muted">{c.case_type.replace(/_/g, " ")}</p>
                </div>
                <StampBadge tone={caseStageTone(c.current_stage_key)}>
                  {c.current_stage_name ?? "Unknown"}
                </StampBadge>
              </Link>
            ))}
            {hasPermission("cases.create") && client.is_active && (
              <Link href={`/dashboard/cases/new?clientId=${client.id}`}>
                <Button size="sm" className="w-full">Start new case</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {admissions.length === 0 && (
              <p className="text-sm text-ink-muted">No admission applications yet.</p>
            )}
            {admissions.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/admissions/${a.id}`}
                className="flex items-center justify-between rounded border border-line px-3 py-2 hover:bg-paper"
              >
                <div>
                  <p className="text-xs font-medium text-ink">{a.institution_name}</p>
                  <p className="text-xs text-ink-muted">{a.intake_term ?? "No intake set"}</p>
                </div>
                <StampBadge tone={admissionStageTone(a.current_stage_key)}>
                  {a.current_stage_name ?? "Unknown"}
                </StampBadge>
              </Link>
            ))}
            {hasPermission("admissions.create") && client.is_active && (
              <Link href={`/dashboard/admissions/new?clientId=${client.id}`}>
                <Button size="sm" className="w-full">Start admission application</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {client.is_active && hasPermission("clients.deactivate") && (
          <Card>
            <CardContent className="py-4">
              <ConfirmDialog
                title="Deactivate this client?"
                description={`${client.full_name} will be marked inactive. Their cases and admissions stay intact and can still be viewed, but no new work should be started against this record. This can be undone by an admin later.`}
                confirmLabel="Deactivate"
                danger
                onConfirm={handleDeactivate}
                trigger={(open) => (
                  <Button variant="danger" size="sm" className="w-full" disabled={updating} onClick={open}>
                    {updating ? "Deactivating..." : "Deactivate client"}
                  </Button>
                )}
              />
              {error && <p className="mt-2 text-sm text-signal-rejected">{error}</p>}
            </CardContent>
          </Card>
        )}

        {!client.is_active && hasPermission("clients.deactivate") && (
          <Card>
            <CardContent className="py-4">
              <Button variant="secondary" size="sm" className="w-full" disabled={updating} onClick={handleReactivate}>
                {updating ? "Reactivating..." : "Reactivate client"}
              </Button>
              {error && <p className="mt-2 text-sm text-signal-rejected">{error}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <DocumentsPanel entityType="client" entityId={client.id} />
      </div>

      <div className="mt-4">
        <CommunicationPanel entityType="client" entityId={client.id} defaultRecipientEmail={client.email} />
      </div>

      <div className="mt-4">
        <TasksPanel entityType="client" entityId={client.id} />
      </div>

      <div className="mt-4">
        <ClientAIPanel clientId={client.id} />
      </div>
    </AppShell>
  );
}

export default function ClientDetailPage() {
  return (
    <ProtectedRoute>
      <ClientDetailContent />
    </ProtectedRoute>
  );
}
