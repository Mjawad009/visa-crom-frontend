"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Task, TaskStatus, TASK_TYPE_LABELS, taskStatusTone, groupTasksByDay } from "@/lib/types/task";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Bell, MapPin, Clock, Repeat } from "lucide-react";

type Scope = "mine" | "all";

function formatDayHeading(day: string): string {
  const date = new Date(day);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(iso: string, allDay: boolean): string {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isOverdue(task: Task): boolean {
  return task.status === "pending" && new Date(task.due_at).getTime() < Date.now();
}

function TasksContent() {
  const { hasPermission, user } = useAuth();
  const canViewAll = hasPermission("tasks.view_all");
  const [scope, setScope] = useState<Scope>("mine");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("pending");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status_filter", statusFilter);
    authedApiClient
      .get<Task[]>(`/tasks/?${params.toString()}`)
      .then(setTasks)
      .catch(() => setError("Could not load tasks."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleComplete(id: string) {
    setBusyId(id);
    try {
      const updated = await authedApiClient.post<Task>(`/tasks/${id}/complete`, {});
      setTasks((prev) => prev?.map((t) => (t.id === id ? updated : t)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete task.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: string) {
    setBusyId(id);
    try {
      const updated = await authedApiClient.post<Task>(`/tasks/${id}/cancel`, {});
      setTasks((prev) => prev?.map((t) => (t.id === id ? updated : t)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel task.");
    } finally {
      setBusyId(null);
    }
  }

  // "All tasks" for staff with tasks.view_all is a client-side toggle
  // over the same response — the backend already returns everyone's
  // tasks once view_all is granted; "mine" narrows it down here so the
  // person doesn't need a second round trip just to switch views.
  const visibleTasks = (tasks ?? []).filter((t) => scope === "all" || !canViewAll || t.assigned_to_user_id === user?.id);
  const grouped = groupTasksByDay(visibleTasks).map((g) => ({
    ...g,
    tasks: g.tasks.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()),
  }));

  return (
    <AppShell title="Tasks & Calendar">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">Tasks & Calendar</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Reminders, follow-ups, and appointments.</p>
        </div>
        <Link href="/dashboard/tasks/new">
          <Button>New task</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-line bg-surface p-0.5">
          {(["pending", "completed", "cancelled", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium capitalize transition-colors",
                statusFilter === s ? "bg-ink text-white" : "text-ink-muted hover:text-ink"
              )}
            >
              {s === "pending" ? "Upcoming" : s}
            </button>
          ))}
        </div>

        {canViewAll && (
          <div className="flex gap-1 rounded-md border border-line bg-surface p-0.5">
            <button
              onClick={() => setScope("mine")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                scope === "mine" ? "bg-ink text-white" : "text-ink-muted hover:text-ink"
              )}
            >
              My tasks
            </button>
            <button
              onClick={() => setScope("all")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                scope === "all" ? "bg-ink text-white" : "text-ink-muted hover:text-ink"
              )}
            >
              Everyone
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-signal-rejected">{error}</p>}

      {tasks && visibleTasks.length === 0 && (
        <EmptyState
          title="Nothing here"
          description="Create a task to get reminders for calls, follow-ups, and appointments."
          action={
            <Link href="/dashboard/tasks/new">
              <Button size="sm">New task</Button>
            </Link>
          }
        />
      )}

      <div className="space-y-5">
        {grouped.map(({ day, tasks: dayTasks }) => (
          <div key={day}>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              {formatDayHeading(day)}
            </h3>
            <div className="space-y-2">
              {dayTasks.map((task) => (
                <Card key={task.id} className={cn("px-4 py-3", isOverdue(task) && "border-signal-rejected/40")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info">{TASK_TYPE_LABELS[task.task_type]}</Badge>
                        <Badge tone={taskStatusTone(task.status)}>{task.status}</Badge>
                        {task.reminder_minutes_before !== null && (
                          <Bell className="h-3 w-3 text-ink-muted" strokeWidth={1.75} />
                        )}
                        {task.recurrence && (
                          <span className="flex items-center gap-0.5 text-xs text-ink-muted">
                            <Repeat className="h-3 w-3" strokeWidth={1.75} />
                            {task.recurrence}
                          </span>
                        )}
                      </div>
                      <Link href={`/dashboard/tasks/${task.id}`} className="mt-1.5 block truncate text-sm font-medium text-ink hover:underline">
                        {task.title}
                      </Link>
                      {task.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{task.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                        <span className={cn("flex items-center gap-1", isOverdue(task) && "text-signal-rejected")}>
                          <Clock className="h-3 w-3" strokeWidth={1.75} />
                          {formatTime(task.due_at, task.all_day)}
                          {isOverdue(task) && " · Overdue"}
                        </span>
                        {task.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" strokeWidth={1.75} />
                            {task.location}
                          </span>
                        )}
                        {task.entity_type && task.entity_id && (
                          <span className="capitalize">
                            Linked: {task.entity_type} #{task.entity_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </div>

                    {task.status === "pending" && (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === task.id}
                          onClick={() => handleCancel(task.id)}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" disabled={busyId === task.id} onClick={() => handleComplete(task.id)}>
                          Complete
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

export default function TasksPage() {
  return (
    <ProtectedRoute>
      <TasksContent />
    </ProtectedRoute>
  );
}
