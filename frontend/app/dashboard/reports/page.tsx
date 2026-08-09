"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
interface DocumentCompliance {
  status_counts: Record<string, number>;
  expiring_within_30_days: number;
}

const CHART_COLORS = ["#14203D", "#A87C2A", "#2A5FA5", "#1E7F55", "#B07A1E", "#B23B32"];

function FunnelChart({ title, data }: { title: string; data: FunnelStage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-ink-muted">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#57607A" }} />
              <YAxis
                type="category"
                dataKey="stage_name"
                width={130}
                tick={{ fontSize: 11, fill: "#57607A" }}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#14203D" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsContent() {
  const [leadFunnel, setLeadFunnel] = useState<FunnelResponse | null>(null);
  const [caseFunnel, setCaseFunnel] = useState<FunnelResponse | null>(null);
  const [admissionsFunnel, setAdmissionsFunnel] = useState<FunnelResponse | null>(null);
  const [branches, setBranches] = useState<BranchRow[] | null>(null);
  const [compliance, setCompliance] = useState<DocumentCompliance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      authedApiClient.get<FunnelResponse>("/reports/funnel/leads"),
      authedApiClient.get<FunnelResponse>("/reports/funnel/cases"),
      authedApiClient.get<FunnelResponse>("/reports/funnel/admissions"),
      authedApiClient.get<{ rows: BranchRow[] }>("/reports/branch-performance"),
      authedApiClient.get<DocumentCompliance>("/reports/document-compliance"),
    ])
      .then(([leads, cases, admissions, branchData, complianceData]) => {
        setLeadFunnel(leads);
        setCaseFunnel(cases);
        setAdmissionsFunnel(admissions);
        setBranches(branchData.rows);
        setCompliance(complianceData);
      })
      .catch(() => setError("Could not load reports."));
  }, []);

  return (
    <AppShell title="Reports & Analytics">
      <div className="mb-6">
        <h2 className="font-display text-xl font-medium text-ink">Reports & Analytics</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Company-wide pipeline health, branch performance, and document compliance.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-signal-rejected">{error}</p>}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FunnelChart title="Lead pipeline" data={leadFunnel?.stages ?? []} />
        <FunnelChart title="Case pipeline" data={caseFunnel?.stages ?? []} />
        <FunnelChart title="Admissions pipeline" data={admissionsFunnel?.stages ?? []} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Branch performance</CardTitle>
            <CardDescription>Open leads, active clients, open cases, and open admissions per branch.</CardDescription>
          </CardHeader>
          <CardContent>
            {!branches || branches.length === 0 ? (
              <p className="text-sm text-ink-muted">No branch data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={branches}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E1E4EA" />
                  <XAxis dataKey="branch_name" tick={{ fontSize: 11, fill: "#57607A" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#57607A" }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="leads" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clients" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cases" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="admissions" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document compliance</CardTitle>
            <CardDescription>Company-wide, all entities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {compliance && (
              <>
                {Object.entries(compliance.status_counts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-ink-muted">{status}</span>
                    <span className="font-medium text-ink">{count}</span>
                  </div>
                ))}
                <div className="border-t border-line pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Expiring within 30 days
                  </p>
                  <p className="mt-1 font-display text-lg text-signal-pending">
                    {compliance.expiring_within_30_days}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}
