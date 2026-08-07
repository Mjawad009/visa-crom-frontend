"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Case, availableCaseTransitions, caseStageTone } from "@/lib/types/case";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StampBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { CommunicationPanel } from "@/components/communications/communication-panel";
import { TasksPanel } from "@/components/tasks/tasks-panel";
import { CaseAIPanel } from "@/components/ai/case-ai-panel";

function CaseDetailContent() {
  const params = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("cases.update");
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    destination_country: "",
    visa_type: "",
    priority: "normal",
    target_submission_date: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await authedApiClient.get<Case>(`/cases/${params.id}`);
      setCaseData(data);
      setForm({
        destination_country: data.destination_country ?? "",
        visa_type: data.visa_type ?? "",
        priority: data.priority,
        target_submission_date: data.target_submission_date ?? "",
        notes: data.notes ?? "",
      });
    } catch {
      setError("Could not load this case.");
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
      const updated = await authedApiClient.post<Case>(`/cases/${params.id}/transition`, {
        transition_key: transitionKey,
      });
      setCaseData(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this case's stage.");
    } finally {
      setTransitioning(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await authedApiClient.patch<Case>(`/cases/${params.id}`, {
        destination_country: form.destination_country || undefined,
        visa_type: form.visa_type || undefined,
        priority: form.priority,
        target_submission_date: form.target_submission_date || undefined,
        notes: form.notes || undefined,
      });
      setCaseData(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !caseData) {
    return (
      <AppShell title="Case">
        <p className="text-sm text-signal-rejected">{error}</p>
      </AppShell>
    );
  }

  if (!caseData) {
    return (
      <AppShell title="Case">
        <p className="text-sm text-ink-muted">Loading...</p>
      </AppShell>
    );
  }

  const transitions = availableCaseTransitions(caseData.current_stage_key);

  return (
    <AppShell title={caseData.reference}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">{caseData.reference}</h2>
          <p className="mt-0.5 text-sm capitalize text-ink-muted">
            {caseData.case_type.replace(/_/g, " ")} · {caseData.destination_country ?? "No destination set"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StampBadge tone={caseStageTone(caseData.current_stage_key)}>
            {caseData.current_stage_name ?? "Unknown"}
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
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Visa type</p>
                <p className="mt-0.5 text-ink">{caseData.visa_type ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Priority</p>
                <p className="mt-0.5 capitalize text-ink">{caseData.priority}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Target submission</p>
                <p className="mt-0.5 text-ink">{caseData.target_submission_date ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Opened</p>
                <p className="mt-0.5 text-ink">{new Date(caseData.created_at).toLocaleDateString()}</p>
              </div>
              {caseData.notes && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notes</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-ink">{caseData.notes}</p>
                </div>
              )}
            </CardContent>
          )}

          {editing && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Destination country</Label>
                  <Input
                    value={form.destination_country}
                    onChange={(e) => setForm((f) => ({ ...f, destination_country: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Visa type</Label>
                  <Input value={form.visa_type} onChange={(e) => setForm((f) => ({ ...f, visa_type: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </div>
                <div>
                  <Label>Target submission date</Label>
                  <Input
                    type="date"
                    value={form.target_submission_date}
                    onChange={(e) => setForm((f) => ({ ...f, target_submission_date: e.target.value }))}
                  />
                </div>
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
              <p className="text-sm text-ink-muted">This case has reached a final stage.</p>
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
        <DocumentsPanel entityType="case" entityId={caseData.id} />
      </div>

      <div className="mt-4">
        <CommunicationPanel entityType="case" entityId={caseData.id} />
      </div>

      <div className="mt-4">
        <TasksPanel entityType="case" entityId={caseData.id} />
      </div>

      <div className="mt-4">
        <CaseAIPanel caseId={caseData.id} clientId={caseData.client_id} />
      </div>
    </AppShell>
  );
}

export default function CaseDetailPage() {
  return (
    <ProtectedRoute>
      <CaseDetailContent />
    </ProtectedRoute>
  );
}
