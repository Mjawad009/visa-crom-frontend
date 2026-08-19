"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { ActivityLog, AuditLog } from "@/lib/types/log";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

type Tab = "activity" | "audit";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function actionTone(action: string): "neutral" | "approved" | "pending" | "rejected" | "info" {
  const a = action.toLowerCase();
  if (a.includes("create") || a.includes("approve")) return "approved";
  if (a.includes("delete") || a.includes("deactivate") || a.includes("reject")) return "rejected";
  if (a.includes("update") || a.includes("edit")) return "pending";
  return "neutral";
}

function LogsContent() {
  const { hasPermission } = useAuth();
  const canViewActivity = hasPermission("logs.view_activity");
  const canViewAudit = hasPermission("logs.view_audit");

  const [tab, setTab] = useState<Tab>(canViewActivity ? "activity" : "audit");
  const [activity, setActivity] = useState<ActivityLog[] | null>(null);
  const [audit, setAudit] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "activity" && activity === null) {
      authedApiClient
        .get<ActivityLog[]>("/logs/activity?limit=100")
        .then(setActivity)
        .catch(() => setError("Could not load activity logs."));
    }
    if (tab === "audit" && audit === null) {
      authedApiClient
        .get<AuditLog[]>("/logs/audit?limit=100")
        .then(setAudit)
        .catch(() => setError("Could not load audit logs."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <AppShell title="Activity & Audit Logs">
      <div className="mb-5">
        <h2 className="font-display text-xl font-medium text-ink">Activity & Audit Logs</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Activity is a running feed of what happened. Audit records before/after state for compliance review.
        </p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-line">
        {canViewActivity && (
          <button
            onClick={() => setTab("activity")}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === "activity" ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
            )}
          >
            Activity
          </button>
        )}
        {canViewAudit && (
          <button
            onClick={() => setTab("audit")}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === "audit" ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
            )}
          >
            Audit
          </button>
        )}
      </div>

      {error && <p className="text-sm text-signal-rejected">{error}</p>}

      {tab === "activity" && activity && activity.length === 0 && (
        <EmptyState title="No activity yet" description="Actions taken across the platform will show up here." />
      )}

      {tab === "activity" && activity && activity.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>When</TableHeaderCell>
              <TableHeaderCell>Module</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
              <TableHeaderCell>Entity</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activity.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-ink-muted">{formatTimestamp(log.created_at)}</TableCell>
                <TableCell className="capitalize text-ink-muted">{log.module.replace(/_/g, " ")}</TableCell>
                <TableCell>
                  <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                </TableCell>
                <TableCell className="text-ink-muted">
                  {log.entity_type} <span className="font-mono text-xs">#{log.entity_id.slice(0, 8)}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {tab === "audit" && audit && audit.length === 0 && (
        <EmptyState title="No audit records yet" description="Before/after state changes will show up here." />
      )}

      {tab === "audit" && audit && audit.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>When</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
              <TableHeaderCell>Entity</TableHeaderCell>
              <TableHeaderCell>Change</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {audit.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-ink-muted">{formatTimestamp(log.created_at)}</TableCell>
                <TableCell>
                  <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                </TableCell>
                <TableCell className="text-ink-muted">
                  {log.entity_type} <span className="font-mono text-xs">#{log.entity_id.slice(0, 8)}</span>
                </TableCell>
                <TableCell className="max-w-md truncate text-xs text-ink-muted">
                  {log.before_json ? "Modified existing record" : "Created new record"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AppShell>
  );
}

export default function LogsPage() {
  return (
    <ProtectedRoute>
      <LogsContent />
    </ProtectedRoute>
  );
}
