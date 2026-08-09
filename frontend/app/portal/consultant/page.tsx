"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Case, CASE_STAGE_ORDER, caseStageTone } from "@/lib/types/case";
import { Lead, stageTone as leadStageTone } from "@/lib/types/lead";
import { Client } from "@/lib/types/client";
import { Card, CardContent } from "@/components/ui/card";
import { StampBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const KANBAN_STAGES = CASE_STAGE_ORDER.filter((s) => s !== "post_visa_support");

function ConsultantPortalContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<Case[] | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This portal is built for the Consultant role; anyone else who lands
    // here (e.g. by URL) gets sent to the general dashboard instead.
    if (user && user.role_key !== "consultant" && !user.is_superuser) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    Promise.all([
      authedApiClient.get<Case[]>("/cases/"),
      authedApiClient.get<Lead[]>("/leads/"),
      authedApiClient.get<Client[]>("/clients/"),
    ])
      .then(([c, l, cl]) => {
        setCases(c);
        setLeads(l);
        setClients(cl);
      })
      .catch(() => setError("Could not load your workspace."));
  }, []);

  const openLeads = (leads ?? []).filter((l) => l.current_stage_key !== "converted" && l.current_stage_key !== "lost");

  return (
    <AppShell title="My Workspace">
      <div className="mb-6">
        <h2 className="font-display text-xl font-medium text-ink">
          Welcome back, {user?.full_name?.split(" ")[0]}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Your leads, clients, and active cases — everything assigned to you in one place.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-signal-rejected">{error}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Open leads</p>
            <p className="mt-1 font-display text-lg text-ink">{leads ? openLeads.length : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Active clients</p>
            <p className="mt-1 font-display text-lg text-ink">{clients ? clients.length : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Cases in progress</p>
            <p className="mt-1 font-display text-lg text-ink">
              {cases ? cases.filter((c) => !c.is_closed).length : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 font-display text-lg text-ink">Case pipeline</h3>
        {cases && cases.length === 0 && (
          <EmptyState title="No cases yet" description="Start a case from any client's profile." />
        )}
        {cases && cases.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {KANBAN_STAGES.map((stageKey) => {
              const stageCases = cases.filter((c) => c.current_stage_key === stageKey);
              if (stageCases.length === 0) return null;
              return (
                <div key={stageKey} className="w-64 shrink-0">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {stageKey.replace(/_/g, " ")} ({stageCases.length})
                  </p>
                  <div className="space-y-2">
                    {stageCases.map((c) => (
                      <Link key={c.id} href={`/dashboard/cases/${c.id}`}>
                        <Card className="cursor-pointer hover:border-ink/30">
                          <CardContent className="py-3">
                            <p className="font-mono text-xs font-medium text-ink">{c.reference}</p>
                            <p className="mt-0.5 text-xs text-ink-muted">{c.client_full_name ?? "Unknown client"}</p>
                            <div className="mt-1.5">
                              <StampBadge tone={caseStageTone(c.current_stage_key)} className="text-[10px]">
                                {c.priority}
                              </StampBadge>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 font-display text-lg text-ink">Leads needing attention</h3>
        {openLeads.length === 0 && <p className="text-sm text-ink-muted">No open leads right now.</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {openLeads.slice(0, 6).map((lead) => (
            <Link key={lead.id} href={`/dashboard/leads/${lead.id}`}>
              <Card className="cursor-pointer hover:border-ink/30">
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{lead.full_name}</p>
                    <p className="text-xs text-ink-muted">{lead.country_of_interest ?? "No country set"}</p>
                  </div>
                  <StampBadge tone={leadStageTone(lead.current_stage_key)}>
                    {lead.current_stage_name ?? "Unknown"}
                  </StampBadge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default function ConsultantPortalPage() {
  return (
    <ProtectedRoute>
      <ConsultantPortalContent />
    </ProtectedRoute>
  );
}
