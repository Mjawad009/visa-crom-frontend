"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient } from "@/lib/api-client";
import { AdmissionApplication, admissionStageTone } from "@/lib/types/admission";
import { StampBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";

function AdmissionsContent() {
  const [apps, setApps] = useState<AdmissionApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedApiClient
      .get<AdmissionApplication[]>("/admissions/")
      .then(setApps)
      .catch(() => setError("Could not load admission applications."));
  }, []);

  return (
    <AppShell title="Admissions">
      <div className="mb-5">
        <h2 className="font-display text-xl font-medium text-ink">Admissions</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          University/institution applications for study-visa clients.
        </p>
      </div>

      {error && <p className="text-sm text-signal-rejected">{error}</p>}

      {apps && apps.length === 0 && (
        <EmptyState
          title="No admission applications yet"
          description="Start one from a client's profile."
        />
      )}

      {apps && apps.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Client</TableHeaderCell>
              <TableHeaderCell>Institution</TableHeaderCell>
              <TableHeaderCell>Intake</TableHeaderCell>
              <TableHeaderCell>Stage</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apps.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/dashboard/admissions/${a.id}`} className="font-medium text-ink hover:underline">
                    {a.client_full_name ?? "Unknown client"}
                  </Link>
                </TableCell>
                <TableCell className="text-ink-muted">
                  {a.institution_name}
                  {a.program_name && <span className="text-xs"> · {a.program_name}</span>}
                </TableCell>
                <TableCell className="text-ink-muted">{a.intake_term ?? "—"}</TableCell>
                <TableCell>
                  <StampBadge tone={admissionStageTone(a.current_stage_key)}>
                    {a.current_stage_name ?? "Unknown"}
                  </StampBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AppShell>
  );
}

export default function AdmissionsPage() {
  return (
    <ProtectedRoute>
      <AdmissionsContent />
    </ProtectedRoute>
  );
}
