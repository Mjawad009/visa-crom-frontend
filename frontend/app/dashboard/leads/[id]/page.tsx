"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Lead, LEAD_SOURCES, LEAD_TRANSITIONS, stageTone } from "@/lib/types/lead";
import { User } from "@/lib/types/user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StampBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { CommunicationPanel } from "@/components/communications/communication-panel";
import { TasksPanel } from "@/components/tasks/tasks-panel";

function LeadDetailContent() {
  const params = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("leads.update");
  const [lead, setLead] = useState<Lead | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    source: "other",
    country_of_interest: "",
    visa_type_interest: "",
    notes: "",
    assigned_to_user_id: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await authedApiClient.get<Lead>(`/leads/${params.id}`);
      setLead(data);
      setForm({
        full_name: data.full_name,
        email: data.email ?? "",
        phone: data.phone ?? "",
        source: data.source,
        country_of_interest: data.country_of_interest ?? "",
        visa_type_interest: data.visa_type_interest ?? "",
        notes: data.notes ?? "",
        assigned_to_user_id: data.assigned_to_user_id ?? "",
      });
    } catch {
      setError("Could not load this lead.");
    }
  }

  useEffect(() => {
    load();
    if (hasPermission("leads.view_all")) {
      authedApiClient.get<User[]>("/users/").then(setUsers).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleTransition(transitionKey: string) {
    setTransitioning(transitionKey);
    setError(null);
    try {
      const updated = await authedApiClient.post<Lead>(`/leads/${params.id}/transition`, {
        transition_key: transitionKey,
      });
      setLead(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this lead's stage.");
    } finally {
      setTransitioning(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await authedApiClient.patch<Lead>(`/leads/${params.id}`, {
        full_name: form.full_name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        source: form.source,
        country_of_interest: form.country_of_interest || undefined,
        visa_type_interest: form.visa_type_interest || undefined,
        notes: form.notes || undefined,
        assigned_to_user_id: form.assigned_to_user_id || undefined,
      });
      setLead(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !lead) {
    return (
      <AppShell title="Lead">
        <p className="text-sm text-signal-rejected">{error}</p>
      </AppShell>
    );
  }

  if (!lead) {
    return (
      <AppShell title="Lead">
        <p className="text-sm text-ink-muted">Loading...</p>
      </AppShell>
    );
  }

  const availableTransitions = lead.current_stage_key ? LEAD_TRANSITIONS[lead.current_stage_key] ?? [] : [];
  const assignedName = users.find((u) => u.id === lead.assigned_to_user_id)?.full_name;

  return (
    <AppShell title={lead.full_name}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">{lead.full_name}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {lead.email ?? "No email"} · {lead.phone ?? "No phone"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StampBadge tone={stageTone(lead.current_stage_key)}>{lead.current_stage_name ?? "Unknown"}</StampBadge>
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
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Source</p>
                <p className="mt-0.5 capitalize text-ink">{lead.source.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Assigned to</p>
                <p className="mt-0.5 text-ink">{assignedName ?? (lead.assigned_to_user_id ? "—" : "Unassigned")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Country of interest</p>
                <p className="mt-0.5 text-ink">{lead.country_of_interest ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Visa type of interest</p>
                <p className="mt-0.5 text-ink">{lead.visa_type_interest ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Created</p>
                <p className="mt-0.5 text-ink">{new Date(lead.created_at).toLocaleDateString()}</p>
              </div>
              {lead.notes && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notes</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-ink">{lead.notes}</p>
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
                  <Label>Source</Label>
                  <Select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                    {LEAD_SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
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
                  <Label>Country of interest</Label>
                  <Input
                    value={form.country_of_interest}
                    onChange={(e) => setForm((f) => ({ ...f, country_of_interest: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Visa type of interest</Label>
                  <Input
                    value={form.visa_type_interest}
                    onChange={(e) => setForm((f) => ({ ...f, visa_type_interest: e.target.value }))}
                  />
                </div>
              </div>

              {users.length > 0 && (
                <div>
                  <Label>Assigned to</Label>
                  <Select
                    value={form.assigned_to_user_id}
                    onChange={(e) => setForm((f) => ({ ...f, assigned_to_user_id: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

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
            <CardTitle>Move stage</CardTitle>
            <CardDescription>Actions available from the current stage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {availableTransitions.length === 0 && lead.current_stage_key !== "converted" && (
              <p className="text-sm text-ink-muted">This lead has reached a final stage.</p>
            )}
            {lead.current_stage_key === "converted" && (
              <Link href={`/dashboard/clients/new?fromLead=${lead.id}`}>
                <Button className="w-full">Create client record</Button>
              </Link>
            )}
            {availableTransitions.map((t) => (
              <Button
                key={t.key}
                variant={t.key === "mark_lost" ? "danger" : "primary"}
                className="w-full"
                disabled={transitioning !== null}
                onClick={() => handleTransition(t.key)}
              >
                {transitioning === t.key ? "Updating..." : t.label}
              </Button>
            ))}
            {error && !editing && <p className="text-sm text-signal-rejected">{error}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <CommunicationPanel entityType="lead" entityId={lead.id} defaultRecipientEmail={lead.email} />
      </div>

      <div className="mt-4">
        <TasksPanel entityType="lead" entityId={lead.id} />
      </div>
    </AppShell>
  );
}

export default function LeadDetailPage() {
  return (
    <ProtectedRoute>
      <LeadDetailContent />
    </ProtectedRoute>
  );
}
