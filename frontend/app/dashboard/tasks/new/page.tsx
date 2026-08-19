"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Task, TaskCreatePayload, TaskType, ReminderChannel } from "@/lib/types/task";
import { User } from "@/lib/types/user";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function NewTaskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();
  const canAssignOthers = hasPermission("tasks.view_all");

  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId = searchParams.get("entityId") ?? undefined;

  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    task_type: "task" as TaskType,
    due_at: toLocalDatetimeInput(new Date(Date.now() + 60 * 60 * 1000)),
    all_day: false,
    location: "",
    assigned_to_user_id: "",
    reminder_minutes_before: "30",
    reminder_channel: "in_app" as ReminderChannel,
    recurrence: "" as "" | "daily" | "weekly" | "monthly",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!canAssignOthers) return;
    authedApiClient.get<User[]>("/users/").then(setUsers).catch(() => {});
  }, [canAssignOthers]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: TaskCreatePayload = {
        title: form.title,
        description: form.description || undefined,
        task_type: form.task_type,
        due_at: new Date(form.due_at).toISOString(),
        all_day: form.all_day,
        location: form.location || undefined,
        assigned_to_user_id: form.assigned_to_user_id || undefined,
        reminder_minutes_before: form.reminder_minutes_before ? Number(form.reminder_minutes_before) : undefined,
        reminder_channel: form.reminder_minutes_before ? form.reminder_channel : undefined,
        entity_type: entityType,
        entity_id: entityId,
        recurrence: form.recurrence || undefined,
      };
      await authedApiClient.post<Task>("/tasks/", payload);
      router.replace("/dashboard/tasks");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="New task">
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 py-5">
            {entityType && entityId && (
              <p className="text-xs text-ink-muted">
                Linked to {entityType} #{entityId.slice(0, 8)}
              </p>
            )}

            <div>
              <Label>Title</Label>
              <Input required value={form.title} onChange={(e) => update("title", e.target.value)} />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.task_type} onChange={(e) => update("task_type", e.target.value as TaskType)}>
                  <option value="task">Task</option>
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="appointment">Appointment</option>
                  <option value="follow_up">Follow-up</option>
                </Select>
              </div>
              <div>
                <Label>Due</Label>
                <Input
                  required
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => update("due_at", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Repeat</Label>
              <Select
                value={form.recurrence}
                onChange={(e) => update("recurrence", e.target.value as typeof form.recurrence)}
              >
                <option value="">Doesn&apos;t repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
              {form.recurrence && (
                <p className="mt-1 text-xs text-ink-muted">
                  The next occurrence is created automatically each time you mark this one complete.
                </p>
              )}
            </div>

            {(form.task_type === "meeting" || form.task_type === "appointment") && (
              <div>
                <Label>Location</Label>
                <Input
                  placeholder="Office, video link, or address"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                />
              </div>
            )}

            {canAssignOthers && (
              <div>
                <Label>Assign to</Label>
                <Select value={form.assigned_to_user_id} onChange={(e) => update("assigned_to_user_id", e.target.value)}>
                  <option value="">Myself{user ? ` (${user.full_name})` : ""}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Remind me</Label>
                <Select
                  value={form.reminder_minutes_before}
                  onChange={(e) => update("reminder_minutes_before", e.target.value)}
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
                  disabled={!form.reminder_minutes_before}
                  value={form.reminder_channel}
                  onChange={(e) => update("reminder_channel", e.target.value as ReminderChannel)}
                >
                  <option value="in_app">In-app</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS (coming soon)</option>
                  <option value="whatsapp">WhatsApp (coming soon)</option>
                </Select>
              </div>
            </div>
            {(form.reminder_channel === "sms" || form.reminder_channel === "whatsapp") && (
              <p className="text-xs text-ink-muted">
                SMS/WhatsApp reminders aren&apos;t wired to a provider yet — you&apos;ll still get an in-app
                notification in the meantime.
              </p>
            )}

            {error && <p className="text-sm text-signal-rejected">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create task"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </AppShell>
  );
}

export default function NewTaskPage() {
  return (
    <ProtectedRoute>
      <NewTaskContent />
    </ProtectedRoute>
  );
}
