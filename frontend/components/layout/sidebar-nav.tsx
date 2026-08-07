"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  ScrollText,
  Bell,
  Sparkles,
  Contact,
  UserSquare2,
  FolderKanban,
  GraduationCap,
  BarChart3,
  CalendarClock,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { getHomeRoute } from "@/lib/role-routes";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string; // omit = visible to any authenticated user
}

// Only Core Platform routes are wired up (Phase 2). Business-module nav
// items (Leads, Cases, Finance, ...) are added here as each phase ships —
// nothing elsewhere in the shell needs to change.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/dashboard/leads", icon: Contact, permission: "leads.view" },
  { label: "Clients", href: "/dashboard/clients", icon: UserSquare2, permission: "clients.view" },
  { label: "Cases", href: "/dashboard/cases", icon: FolderKanban, permission: "cases.view" },
  { label: "Admissions", href: "/dashboard/admissions", icon: GraduationCap, permission: "admissions.view" },
  { label: "Tasks & Calendar", href: "/dashboard/tasks", icon: CalendarClock, permission: "tasks.view" },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3, permission: "reports.view" },
  { label: "Users", href: "/dashboard/users", icon: Users, permission: "users.view" },
  { label: "Branches", href: "/dashboard/branches", icon: Building2, permission: "branches.view" },
  { label: "Roles & Permissions", href: "/dashboard/roles", icon: ShieldCheck, permission: "roles.manage" },
  { label: "Activity & Audit Logs", href: "/dashboard/logs", icon: ScrollText, permission: "logs.view_activity" },
  { label: "AI Assistant", href: "/dashboard/ai", icon: Sparkles, permission: "ai.use_assistant" },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
];

interface SidebarNavProps {
  /** Only meaningful below the lg breakpoint — desktop always shows the
   * sidebar regardless of this prop. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SidebarNav({ mobileOpen = false, onMobileClose }: SidebarNavProps) {
  const { user, hasPermission } = useAuth();
  const pathname = usePathname();

  const homeRoute = getHomeRoute(user?.role_key);
  const items = NAV_ITEMS.map((item) => (item.href === "/dashboard" ? { ...item, href: homeRoute } : item));
  const visibleItems = items.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap outside it */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}

      <aside
        className={cn(
          "flex h-screen w-60 shrink-0 flex-col bg-ink text-white/90",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div>
            <p className="font-display text-lg font-medium tracking-tight text-white">Consultancy CRM</p>
            <p className="mt-0.5 text-xs text-white/50">
              {user?.role_key.replace(/_/g, " ")}
            </p>
          </div>
          <button onClick={onMobileClose} className="text-white/60 hover:text-white lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors",
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-xs text-white/40">
          Phase 18 — Tasks & Calendar
        </div>
      </aside>
    </>
  );
}
