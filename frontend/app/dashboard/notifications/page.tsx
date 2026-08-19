"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { Notification, notificationTone } from "@/lib/types/notification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  function load(unreadOnly: boolean) {
    authedApiClient
      .get<Notification[]>(`/notifications/${unreadOnly ? "?unread_only=true" : ""}`)
      .then(setNotifications)
      .catch(() => setError("Could not load notifications."));
  }

  useEffect(() => {
    load(filter === "unread");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function markRead(id: string) {
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, is_read: true } : n)) ?? prev);
    try {
      await authedApiClient.post(`/notifications/${id}/read`, {});
    } catch {
      // best-effort; a page refresh will resync state
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? prev);
    try {
      await authedApiClient.post("/notifications/read-all", {});
    } catch {
      // best-effort; a page refresh will resync state
    }
  }

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  return (
    <AppShell title="Notifications">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-ink">Notifications</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md border border-line bg-surface p-0.5">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                filter === "all" ? "bg-ink text-white" : "text-ink-muted hover:text-ink"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                filter === "unread" ? "bg-ink text-white" : "text-ink-muted hover:text-ink"
              )}
            >
              Unread
            </button>
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="secondary" onClick={markAllRead}>
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-signal-rejected">{error}</p>}

      {notifications && notifications.length === 0 && (
        <EmptyState
          title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
          description="You'll see updates about your leads, cases, and tasks here."
        />
      )}

      {notifications && notifications.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {notifications.map((n) => {
            const body = (
              <div
                className={cn(
                  "flex items-start justify-between gap-4 px-4 py-3",
                  !n.is_read && "bg-signal-info/5"
                )}
              >
                <div className="flex items-start gap-3">
                  {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal-info" />}
                  <div>
                    <p className={cn("text-sm", n.is_read ? "text-ink-muted" : "font-medium text-ink")}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-ink-muted">{n.body}</p>}
                    <p className="mt-1 text-xs text-ink-muted/70">{formatTimestamp(n.created_at)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={notificationTone(n.type)}>{n.type}</Badge>
                  {!n.is_read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            );

            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} onClick={() => !n.is_read && markRead(n.id)} className="block hover:bg-paper/60">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
