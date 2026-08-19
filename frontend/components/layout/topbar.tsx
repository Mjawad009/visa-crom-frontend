"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { authedApiClient } from "@/lib/api-client";
import { Notification } from "@/lib/types/notification";

// Routes a person lands on right after login (see lib/role-routes.ts) —
// there's nothing meaningful to go "back" to from here, so the back
// button hides on these specifically rather than on every top-level
// list page (going back from e.g. /dashboard/leads to wherever you
// were before is still useful).
const HOME_ROUTES = ["/dashboard", "/portal/consultant", "/portal/visa-processing", "/portal/admissions"];

export function Topbar({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const showBack = !HOME_ROUTES.includes(pathname);

  useEffect(() => {
    authedApiClient
      .get<Notification[]>("/notifications/?unread_only=true")
      .then((data) => setUnreadCount(data.length))
      .catch(() => {});
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <button
          onClick={onMenuClick}
          className="rounded p-1.5 text-ink-muted hover:bg-paper hover:text-ink lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        {showBack && (
          <button
            onClick={() => router.back()}
            className="rounded p-1.5 text-ink-muted hover:bg-paper hover:text-ink"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4.5 w-4.5" strokeWidth={1.75} />
          </button>
        )}
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
