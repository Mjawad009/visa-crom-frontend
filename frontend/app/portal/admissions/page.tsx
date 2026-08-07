"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { AdmissionApplication, ADMISSION_STAGE_ORDER, admissionStageTone } from "@/lib/types/admission";
import { Card, CardContent } from "@/components/ui/card";
import { StampBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const KANBAN_STAGES = ADMISSION_STAGE_ORDER.filter((s) => s !== "completed");

function AdmissionsPortalContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<AdmissionApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role_key !== "admissions_officer" && !user.is_superuser) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    // admissions.view (not view_all) means this naturally returns only
    // this officer's own caseload — same personal-ownership shape as the
    // Consultant Portal (Phase 8), confirming the design guess made
    // before this phase started.
    authedApiClient
      .get<AdmissionApplication[]>("/admissions/")
      .then(setApps)
      .catch(() => setError("Could not load your admissions caseload."));
  }, []);

  const openApps = (apps ?? []).filter((a) => !a.is_closed);

  return (
    <AppShell title="My Admissions">
      <div className="mb-6">
        <h2 className="font-display text-xl font-medium text-ink">
          Welcome back, {user?.full_name?.split(" ")[0]}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Your admission applications, from preparation through document issuance.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-signal-rejected">{error}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Open applications</p>
            <p className="mt-1 font-display text-lg text-ink">{apps ? openApps.length : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Completed</p>
            <p className="mt-1 font-display text-lg text-ink">
              {apps ? apps.filter((a) => a.current_stage_key === "completed").length : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <h3 className="mb-3 font-display text-lg text-ink">Applications pipeline</h3>
      {apps && apps.length === 0 && (
        <EmptyState title="No applications yet" description="Start one from any client's profile." />
      )}
      {apps && apps.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_STAGES.map((stageKey) => {
            const stageApps = openApps.filter((a) => a.current_stage_key === stageKey);
            if (stageApps.length === 0) return null;
            return (
              <div key={stageKey} className="w-64 shrink-0">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {stageKey.replace(/_/g, " ")} ({stageApps.length})
                </p>
                <div className="space-y-2">
                  {stageApps.map((a) => (
                    <Link key={a.id} href={`/dashboard/admissions/${a.id}`}>
                      <Card className="cursor-pointer hover:border-ink/30">
                        <CardContent className="py-3">
                          <p className="text-xs font-medium text-ink">{a.client_full_name ?? "Unknown client"}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">{a.institution_name}</p>
                          <div className="mt-1.5">
                            <StampBadge tone={admissionStageTone(a.current_stage_key)} className="text-[10px]">
                              {a.intake_term ?? "No intake"}
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
    </AppShell>
  );
}

export default function AdmissionsPortalPage() {
  return (
    <ProtectedRoute>
      <AdmissionsPortalContent />
    </ProtectedRoute>
  );
}
