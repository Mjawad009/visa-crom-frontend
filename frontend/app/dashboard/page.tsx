"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { getHomeRoute } from "@/lib/role-routes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StampBadge } from "@/components/ui/badge";
import { Lead } from "@/lib/types/lead";
import { Client } from "@/lib/types/client";
import { Case, caseStageTone } from "@/lib/types/case";
import { AdmissionApplication } from "@/lib/types/admission";
import { Task, taskStatusTone } from "@/lib/types/task";
import { Notification } from "@/lib/types/notification";
import { User } from "@/lib/types/user";
import { ActivityLog } from "@/lib/types/log";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface FunnelStage {
  stage_key: string;
  stage_name: string;
  count: number;
}
interface FunnelResponse {
  definition_key: string;
  stages: FunnelStage[];
}
interface BranchRow {
  branch_id: string;
  branch_name: string;
  leads: number;
  clients: number;
  cases: number;
  admissions: number;
}
interface StaffWorkloadRow {
  user_id: string;
  open_case_count: number;
}

const CHART_COLOR = "#14203D";

function StatCard({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <Card className={href ? "transition-colors hover:bg-paper/60" : undefined}>
      <CardContent className="py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="mt-1 font-display text-2xl text-ink">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function DashboardContent() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [cases, setCases] = useState<Case[] | null>(null);
  const [admissions, setAdmissions] = useState<AdmissionApplication[] | null>(null);
  const [myTasks, setMyTasks] = useState<Task[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [leadFunnel, setLeadFunnel] = useState<FunnelResponse | null>(null);
  const [branchPerf, setBranchPerf] = useState<BranchRow[] | null>(null);
  const [workload, setWorkload] = useState<StaffWorkloadRow[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activity, setActivity] = useState<ActivityLog[] | null>(null);

  useEffect(() => {
    // Roles with a dedicated portal (see lib/role-routes.ts) belong there,
    // not on the general admin dashboard — send them along if they land
    // here directly (bookmark, back button, etc).
    if (user) {
      const home = getHomeRoute(user.role_key);
      if (home !== "/dashboard") router.replace(home);
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    if (hasPermission("leads.view") || hasPermission("leads.view_all")) {
      authedApiClient.get<Lead[]>("/leads/").then(setLeads).catch(() => {});
    }
    if (hasPermission("clients.view")) {
      authedApiClient.get<Client[]>("/clients/").then(setClients).catch(() => {});
    }
    if (hasPermission("cases.view") || hasPermission("cases.view_all")) {
      authedApiClient.get<Case[]>("/cases/").then(setCases).catch(() => {});
    }
    if (hasPermission("admissions.view")) {
      authedApiClient.get<AdmissionApplication[]>("/admissions/").then(setAdmissions).catch(() => {});
    }
    authedApiClient.get<Task[]>("/tasks/?status_filter=pending").then(setMyTasks).catch(() => {});
    authedApiClient
      .get<Notification[]>("/notifications/?unread_only=true")
      .then((n) => setUnreadCount(n.length))
      .catch(() => {});

    if (hasPermission("reports.view")) {
      authedApiClient.get<FunnelResponse>("/reports/funnel/leads").then(setLeadFunnel).catch(() => {});
      authedApiClient
        .get<{ rows: BranchRow[] }>("/reports/branch-performance")
        .then((r) => setBranchPerf(r.rows))
        .catch(() => {});
      authedApiClient
        .get<{ rows: StaffWorkloadRow[] }>("/reports/staff-workload")
        .then((r) => setWorkload(r.rows.slice(0, 6)))
        .catch(() => {});
    }
    if (hasPermission("users.view")) {
      authedApiClient.get<User[]>("/users/").then(setUsers).catch(() => {});
    }
    if (hasPermission("logs.view_activity")) {
      authedApiClient.get<ActivityLog[]>("/logs/activity?limit=8").then(setActivity).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openLeads = leads?.filter((l) => !l.is_converted && l.current_stage_key !== "lost").length;
  const openCases = cases?.filter((c) => !c.is_closed).length;
  const openAdmissions = admissions?.filter((a) => !a.is_closed).length;
  const myOpenTasks = myTasks?.filter((t) => t.assigned_to_user_id === user?.id).length;
  const overdueTasks = myTasks?.filter((t) => t.assigned_to_user_id === user?.id && new Date(t.due_at) < new Date()).length ?? 0;

  const workloadWithNames = (workload ?? []).map((w) => ({
    name: users.find((u) => u.id === w.user_id)?.full_name ?? `User ${w.user_id.slice(0, 8)}`,
    open_case_count: w.open_case_count,
  }));

  const upcomingTasks = (myTasks ?? [])
    .filter((t) => t.assigned_to_user_id === user?.id)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    .slice(0, 5);

  return (
    <AppShell title="Dashboard">
      <div className="mb-6">
        <h2 className="font-display text-xl font-medium text-ink">
          Welcome back, {user?.full_name?.split(" ")[0]}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Here's what's moving across the consultancy today.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {leads && <StatCard label="Open leads" value={openLeads ?? 0} href="/dashboard/leads" />}
        {clients && <StatCard label="Active clients" value={clients.length} href="/dashboard/clients" />}
        {cases && <StatCard label="Open cases" value={openCases ?? 0} href="/dashboard/cases" />}
        {admissions && <StatCard label="Open admissions" value={openAdmissions ?? 0} href="/dashboard/admissions" />}
        <StatCard label="My open tasks" value={myOpenTasks ?? 0} href="/dashboard/tasks" />
        <StatCard label="Unread notifications" value={unreadCount} href="/dashboard/notifications" />
      </div>

      {hasPermission("reports.view") && (leadFunnel || branchPerf || workloadWithNames.length > 0) && (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Lead pipeline</CardTitle>
              <CardDescription>
                <Link href="/dashboard/reports" className="hover:underline">Full reports →</Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!leadFunnel || leadFunnel.stages.length === 0 ? (
                <p className="text-sm text-ink-muted">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={leadFunnel.stages} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#57607A" }} />
                    <YAxis type="category" dataKey="stage_name" width={110} tick={{ fontSize: 11, fill: "#57607A" }} />
                    <Tooltip />
                    <Bar dataKey="count" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branch performance</CardTitle>
              <CardDescription>Leads per branch, right now.</CardDescription>
            </CardHeader>
            <CardContent>
              {!branchPerf || branchPerf.length === 0 ? (
                <p className="text-sm text-ink-muted">No branch data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={branchPerf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" />
                    <XAxis dataKey="branch_name" tick={{ fontSize: 10, fill: "#57607A" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#57607A" }} />
                    <Tooltip />
                    <Bar dataKey="leads" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team workload</CardTitle>
              <CardDescription>Open cases per consultant.</CardDescription>
            </CardHeader>
            <CardContent>
              {workloadWithNames.length === 0 ? (
                <p className="text-sm text-ink-muted">No open cases assigned yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={workloadWithNames} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#57607A" }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#57607A" }} />
                    <Tooltip />
                    <Bar dataKey="open_case_count" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your upcoming tasks</CardTitle>
            <CardDescription>
              {overdueTasks > 0 ? `${overdueTasks} overdue` : "Next up, soonest first."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingTasks.length === 0 && <p className="text-sm text-ink-muted">Nothing due — you're clear.</p>}
            {upcomingTasks.map((task) => (
              <Link
                key={task.id}
                href="/dashboard/tasks"
                className="flex items-center justify-between rounded border border-line px-3 py-2 hover:bg-paper"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{task.title}</p>
                  <p className="text-xs text-ink-muted">{formatTimestamp(task.due_at)}</p>
                </div>
                <StampBadge tone={taskStatusTone(task.status)}>{task.status}</StampBadge>
              </Link>
            ))}
          </CardContent>
        </Card>

        {hasPermission("logs.view_activity") ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                <Link href="/dashboard/logs" className="hover:underline">Full activity log →</Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!activity || activity.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing logged yet.</p>
              ) : (
                activity.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">
                      <span className="capitalize text-ink">{log.action}</span> — {log.module.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-ink-muted">{formatTimestamp(log.created_at)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your cases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!cases || cases.length === 0 ? (
                <p className="text-sm text-ink-muted">No cases yet.</p>
              ) : (
                cases.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/cases/${c.id}`}
                    className="flex items-center justify-between rounded border border-line px-3 py-2 hover:bg-paper"
                  >
                    <div>
                      <p className="font-mono text-xs text-ink">{c.reference}</p>
                      <p className="text-xs text-ink-muted">{c.client_full_name ?? "—"}</p>
                    </div>
                    <StampBadge tone={caseStageTone(c.current_stage_key)}>
                      {c.current_stage_name ?? "Unknown"}
                    </StampBadge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
