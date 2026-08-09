"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { authedApiClient } from "@/lib/api-client";
import { Notification } from "@/lib/types/notification";

export function Topbar({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    authedApiClient
      .get<Notification[]>("/notifications/?unread_only=true")
      .then((data) => setUnreadCount(data.length))
      .catch(() => {});
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded p-1.5 text-ink-muted hover:bg-paper hover:text-ink lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <h1 className="truncate font-display text-base font-medium text-ink">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          href="/dashboard/notifications"
          className="relative rounded p-1.5 text-ink-muted hover:bg-paper hover:text-ink"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-signal-rejected text-[9px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="hidden items-center gap-2.5 sm:flex">
          <Avatar name={user?.full_name ?? "?"} />
          <div className="leading-tight">
            <p className="text-sm font-medium text-ink">{user?.full_name}</p>
            <p className="text-xs text-ink-muted">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="rounded p-1.5 text-ink-muted hover:bg-paper hover:text-ink"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
