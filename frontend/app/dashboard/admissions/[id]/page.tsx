"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { AdmissionApplication, admissionStageTone, availableAdmissionTransitions } from "@/lib/types/admission";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StampBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { CommunicationPanel } from "@/components/communications/communication-panel";
import { TasksPanel } from "@/components/tasks/tasks-panel";
import { AdmissionAIPanel } from "@/components/ai/admission-ai-panel";

function AdmissionDetailContent() {
  const params = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("admissions.update");
  const [app, setApp] = useState<AdmissionApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    institution_name: "",
    program_name: "",
    country: "",
    intake_term: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await authedApiClient.get<AdmissionApplication>(`/admissions/${params.id}`);
      setApp(data);
      setForm({
        institution_name: data.institution_name,
        program_name: data.program_name ?? "",
        country: data.country ?? "",
        intake_term: data.intake_term ?? "",
        notes: data.notes ?? "",
      });
    } catch {
      setError("Could not load this application.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleTransition(transitionKey: string) {
    setTransitioning(transitionKey);
    setError(null);
    try {
      const updated = await authedApiClient.post<AdmissionApplication>(`/admissions/${params.id}/transition`, {
        transition_key: transitionKey,
      });
      setApp(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this application's stage.");
    } finally {
      setTransitioning(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await authedApiClient.patch<AdmissionApplication>(`/admissions/${params.id}`, {
        institution_name: form.institution_name,
        program_name: form.program_name || undefined,
        country: form.country || undefined,
        intake_term: form.intake_term || undefined,
        notes: form.notes || undefined,
      });
      setApp(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !app) {
    return (
      <AppShell title="Admission application">
        <p className="text-sm text-signal-rejected">{error}</p>
      </AppShell>
    );
  }

  if (!app) {
    return (
      <AppShell title="Admission application">
        <p className="text-sm text-ink-muted">Loading...</p>
      </AppShell>
    );
  }

  const transitions = availableAdmissionTransitions(app.current_stage_key);

  return (
    <AppShell title={app.institution_name}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">{app.institution_name}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {app.client_full_name ?? "Unknown client"} · {app.program_name ?? "No program set"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StampBadge tone={admissionStageTone(app.current_stage_key)}>
            {app.current_stage_name ?? "Unknown"}
          </StampBadge>
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
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Program</p>
                <p className="mt-0.5 text-ink">{app.program_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Country</p>
                <p className="mt-0.5 text-ink">{app.country ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Intake term</p>
                <p className="mt-0.5 text-ink">{app.intake_term ?? "—"}</p>
              </div>
              {app.notes && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notes</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-ink">{app.notes}</p>
                </div>
              )}
            </CardContent>
          )}

          {editing && (
            <CardContent className="space-y-4">
              <div>
                <Label>Institution name</Label>
                <Input
                  value={form.institution_name}
                  onChange={(e) => setForm((f) => ({ ...f, institution_name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Program</Label>
                  <Input value={form.program_name} onChange={(e) => setForm((f) => ({ ...f, program_name: e.target.value }))} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Intake term</Label>
                <Input
                  placeholder="e.g. Fall 2026"
                  value={form.intake_term}
                  onChange={(e) => setForm((f) => ({ ...f, intake_term: e.target.value }))}
                />
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
            <CardTitle>Move stage</CardTitle>
            <CardDescription>Actions available from the current stage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {transitions.length === 0 && (
              <p className="text-sm text-ink-muted">This application has reached a final stage.</p>
            )}
            {transitions.map((t) => (
              <Button
                key={t.key}
                variant={t.key === "close_unsuccessful" ? "danger" : "primary"}
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
        <DocumentsPanel entityType="admission" entityId={app.id} />
      </div>

      <div className="mt-4">
        <CommunicationPanel entityType="admission" entityId={app.id} />
      </div>

      <div className="mt-4">
        <TasksPanel entityType="admission" entityId={app.id} />
      </div>

      <div className="mt-4">
        <AdmissionAIPanel admissionId={app.id} clientId={app.client_id} />
      </div>
    </AppShell>
  );
}

export default function AdmissionDetailPage() {
  return (
    <ProtectedRoute>
      <AdmissionDetailContent />
    </ProtectedRoute>
  );
}
