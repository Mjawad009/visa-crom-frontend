"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Task, TaskType, taskStatusTone, TASK_TYPE_LABELS } from "@/lib/types/task";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface TasksPanelProps {
  entityType: string;
  entityId: string;
}

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TasksPanel({ entityType, entityId }: TasksPanelProps) {
  const { hasPermission } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("follow_up");
  const [dueAt, setDueAt] = useState(toLocalDatetimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));

  async function load() {
    try {
      const data = await authedApiClient.get<Task[]>(
        `/tasks/?entity_type=${entityType}&entity_id=${entityId}&status_filter=pending`
      );
      setTasks(data);
    } catch {
      setError("Could not load tasks.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const canCreate = hasPermission("tasks.create");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await authedApiClient.post("/tasks/", {
        title,
        task_type: taskType,
        due_at: new Date(dueAt).toISOString(),
        entity_type: entityType,
        entity_id: entityId,
        reminder_minutes_before: 30,
      });
      setTitle("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create task.");
    } finally {
      setCreating(false);
    }
  }

  async function handleComplete(id: string) {
    setBusyId(id);
    try {
      await authedApiClient.post(`/tasks/${id}/complete`, {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete task.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks & Follow-ups</CardTitle>
        <CardDescription>Reminders and to-dos tied to this record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canCreate && (
          <form onSubmit={handleCreate} className="space-y-2 rounded border border-dashed border-line p-3">
            <div className="flex gap-2">
              <Input
                required
                placeholder="e.g. Follow up on missing bank statement"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>
                  <option value="follow_up">Follow-up</option>
                  <option value="task">Task</option>
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                  <option value="appointment">Appointment</option>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Due</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={creating}>
                {creating ? "Adding..." : "Add task"}
              </Button>
            </div>
          </form>
        )}

        {tasks.length === 0 && <p className="text-sm text-ink-muted">No open tasks for this record.</p>}

        {tasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between gap-3 rounded border border-line p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="info">{TASK_TYPE_LABELS[task.task_type]}</Badge>
                <Badge tone={taskStatusTone(task.status)}>{task.status}</Badge>
              </div>
              <Link href={`/dashboard/tasks/${task.id}`} className="mt-1 block truncate text-sm font-medium text-ink hover:underline">
                {task.title}
              </Link>
              <p className="text-xs text-ink-muted">
                Due {new Date(task.due_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <Button size="sm" variant="secondary" disabled={busyId === task.id} onClick={() => handleComplete(task.id)}>
              Complete
            </Button>
          </div>
        ))}

        {error && <p className="text-sm text-signal-rejected">{error}</p>}
      </CardContent>
    </Card>
  );
}
