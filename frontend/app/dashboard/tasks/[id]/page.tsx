"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Task, TaskType, ReminderChannel, taskStatusTone, TASK_TYPE_LABELS } from "@/lib/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TaskDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission("tasks.update");
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    task_type: "task" as TaskType,
    due_at: "",
    location: "",
    reminder_minutes_before: "",
    reminder_channel: "in_app" as ReminderChannel,
  });

  async function load() {
    try {
      const data = await authedApiClient.get<Task>(`/tasks/${params.id}`);
      setTask(data);
      setForm({
        title: data.title,
        description: data.description ?? "",
        task_type: data.task_type,
        due_at: toLocalDatetimeInput(data.due_at),
        location: data.location ?? "",
        reminder_minutes_before: data.reminder_minutes_before?.toString() ?? "",
        reminder_channel: data.reminder_channel,
      });
    } catch {
      setError("Could not load this task.");
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
      const updated = await authedApiClient.patch<Task>(`/tasks/${params.id}`, {
        title: form.title,
        description: form.description || undefined,
        task_type: form.task_type,
        due_at: new Date(form.due_at).toISOString(),
        location: form.location || undefined,
        reminder_minutes_before: form.reminder_minutes_before ? Number(form.reminder_minutes_before) : undefined,
        reminder_channel: form.reminder_minutes_before ? form.reminder_channel : undefined,
      });
      setTask(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await authedApiClient.post<Task>(`/tasks/${task.id}/complete`, {});
      setTask(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await authedApiClient.post<Task>(`/tasks/${task.id}/cancel`, {});
      setTask(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel task.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !task) {
    return (
      <AppShell title="Task">
        <p className="text-sm text-signal-rejected">{error}</p>
      </AppShell>
    );
  }

  if (!task) {
    return (
      <AppShell title="Task">
        <p className="text-sm text-ink-muted">Loading...</p>
      </AppShell>
    );
  }

  const editable = canUpdate && task.status === "pending";

  return (
    <AppShell title={task.title}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">{task.title}</h2>
          {task.entity_type && task.entity_id && (
            <p className="mt-0.5 text-sm capitalize text-ink-muted">
              Linked to {task.entity_type} #{task.entity_id.slice(0, 8)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={taskStatusTone(task.status)}>{task.status}</Badge>
          {canUpdate && task.status === "pending" && (
            <>
              <Button variant="secondary" size="sm" disabled={saving} onClick={handleCancel}>
                Cancel task
              </Button>
              <Button size="sm" disabled={saving} onClick={handleComplete}>
                Complete
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-5">
          {!editable && (
            <p className="text-xs text-ink-muted">
              {task.status === "pending"
                ? "You don't have permission to edit this task."
                : `This task is ${task.status} and can no longer be edited.`}
            </p>
          )}

          <div>
            <Label>Title</Label>
            <Input disabled={!editable} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              disabled={!editable}
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select
                disabled={!editable}
                value={form.task_type}
                onChange={(e) => setForm((f) => ({ ...f, task_type: e.target.value as TaskType }))}
              >
                {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Due</Label>
              <Input
                disabled={!editable}
                type="datetime-local"
                value={form.due_at}
                onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
              />
            </div>
          </div>

          {(form.task_type === "meeting" || form.task_type === "appointment") && (
            <div>
              <Label>Location</Label>
              <Input
                disabled={!editable}
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Remind me</Label>
              <Select
                disabled={!editable}
                value={form.reminder_minutes_before}
                onChange={(e) => setForm((f) => ({ ...f, reminder_minutes_before: e.target.value }))}
              >
                <option value="">No reminder</option>
                <option value="0">At the time</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </Select>
            </div>
            <div>
              <Label>Via</Label>
              <Select
                disabled={!editable || !form.reminder_minutes_before}
                value={form.reminder_channel}
                onChange={(e) => setForm((f) => ({ ...f, reminder_channel: e.target.value as ReminderChannel }))}
              >
                <option value="in_app">In-app</option>
                <option value="email">Email</option>
                <option value="sms">SMS (coming soon)</option>
                <option value="whatsapp">WhatsApp (coming soon)</option>
              </Select>
            </div>
          </div>

          {task.recurrence && (
            <p className="text-xs text-ink-muted">
              Repeats {task.recurrence}. Completing this task creates the next occurrence automatically.
            </p>
          )}

          {error && <p className="text-sm text-signal-rejected">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Back
            </Button>
            {editable && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

export default function TaskDetailPage() {
  return (
    <ProtectedRoute>
      <TaskDetailContent />
    </ProtectedRoute>
  );
}
