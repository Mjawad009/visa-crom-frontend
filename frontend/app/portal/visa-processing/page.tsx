"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Case, availableCaseTransitions } from "@/lib/types/case";
import { FileRecord } from "@/lib/types/file";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// The stages this portal is a queue over - the ones Visa Processing
// Officers actually work, as opposed to Consultation/Document Collection
// (Consultants/Documentation Officers) or Post Visa Support (done).
const PROCESSING_STAGES = ["submission", "biometrics", "medical", "interview", "decision"];

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function VisaProcessingPortalContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<Case[] | null>(null);
  const [expiringFiles, setExpiringFiles] = useState<FileRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role_key !== "visa_processing_officer" && !user.is_superuser) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  async function load() {
    try {
      // cases.view_all means this returns every case company/branch-wide -
      // this portal is a shared team queue, not a personal "my cases" view.
      // Known simplification: stage filtering happens client-side rather
      // than as a query param; fine at this scale, worth revisiting
      // (alongside a real query-param filter on GET /cases) if case volume
      // ever makes fetching the full list impractical.
      const [allCases, expiring] = await Promise.all([
        authedApiClient.get<Case[]>("/cases/"),
        authedApiClient.get<FileRecord[]>("/files/expiring?within_days=30"),
      ]);
      setCases(allCases);
      setExpiringFiles(expiring);
    } catch {
      setError("Could not load the processing queue.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleTransition(caseId: string, transitionKey: string) {
    setBusyCaseId(caseId);
    setError(null);
    try {
      const updated = await authedApiClient.post<Case>(`/cases/${caseId}/transition`, { transition_key: transitionKey });
      setCases((prev) => (prev ? prev.map((c) => (c.id === caseId ? updated : c)) : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this case.");
    } finally {
      setBusyCaseId(null);
    }
  }

  const queueCases = (cases ?? []).filter((c) => c.current_stage_key && PROCESSING_STAGES.includes(c.current_stage_key));

  return (
    <AppShell title="Processing Queue">
      <div className="mb-6">
        <h2 className="font-display text-xl font-medium text-ink">Visa Processing Queue</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Every case company-wide currently at Submission through Decision, soonest deadline first.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-signal-rejected">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {cases && queueCases.length === 0 && (
            <EmptyState title="Queue is empty" description="No cases are currently at a processing stage." />
          )}

          <div className="space-y-4">
            {PROCESSING_STAGES.map((stageKey) => {
              const stageCases = queueCases
                .filter((c) => c.current_stage_key === stageKey)
                .sort((a, b) => {
                  const da = daysUntil(a.target_submission_date);
                  const db = daysUntil(b.target_submission_date);
                  if (da === null) return 1;
                  if (db === null) return -1;
                  return da - db;
                });
              if (stageCases.length === 0) return null;

              return (
                <div key={stageKey}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {stageKey.replace(/_/g, " ")} ({stageCases.length})
                  </p>
                  <div className="space-y-2">
                    {stageCases.map((c) => {
                      const days = daysUntil(c.target_submission_date);
                      const transitions = availableCaseTransitions(c.current_stage_key);
                      return (
                        <Card key={c.id}>
                          <CardContent className="flex items-center justify-between gap-4 py-3">
                            <div className="min-w-0 flex-1">
                              <Link href={`/dashboard/cases/${c.id}`} className="font-mono text-xs font-medium text-ink hover:underline">
                                {c.reference}
                              </Link>
                              <p className="truncate text-xs text-ink-muted">
                                {c.client_full_name ?? "Unknown client"} · {c.destination_country ?? "No destination"}
                              </p>
                              {days !== null && (
                                <p className={`mt-0.5 text-xs ${days < 3 ? "text-signal-rejected" : "text-ink-muted"}`}>
                                  {days >= 0 ? `${days}d until target submission` : `${Math.abs(days)}d overdue`}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                              {transitions.map((t) => (
                                <Button
                                  key={t.key}
                                  size="sm"
                                  variant={t.key === "close_unsuccessful" ? "danger" : "secondary"}
                                  disabled={busyCaseId === c.id}
                                  onClick={() => handleTransition(c.id, t.key)}
                                >
                                  {busyCaseId === c.id ? "..." : t.label}
                                </Button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Documents expiring soon
          </p>
          <div className="space-y-2">
            {expiringFiles && expiringFiles.length === 0 && (
              <p className="text-sm text-ink-muted">Nothing expiring in the next 30 days.</p>
            )}
            {(expiringFiles ?? []).map((file) => (
              <Card key={file.id}>
                <CardContent className="py-3">
                  <p className="text-sm font-medium text-ink">{file.filename}</p>
                  <p className="mt-0.5 text-xs capitalize text-ink-muted">
                    {(file.category ?? "uncategorized").replace(/_/g, " ")}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <Badge tone="pending">Expires {file.expiry_date}</Badge>
                    <Link
                      href={file.entity_type === "case" ? `/dashboard/cases/${file.entity_id}` : `/dashboard/clients/${file.entity_id}`}
                      className="text-xs text-ink-muted hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function VisaProcessingPortalPage() {
  return (
    <ProtectedRoute>
      <VisaProcessingPortalContent />
    </ProtectedRoute>
  );
}
