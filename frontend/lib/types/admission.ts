export interface AdmissionApplication {
  id: string;
  client_id: string;
  branch_id: string | null;
  assigned_officer_id: string | null;
  institution_name: string;
  program_name: string | null;
  country: string | null;
  intake_term: string | null;
  notes: string | null;
  is_closed: boolean;
  closed_reason: string | null;
  created_at: string;
  current_stage_key: string | null;
  current_stage_name: string | null;
  client_full_name: string | null;
}

export const ADMISSION_STAGE_ORDER = [
  "preparing_application",
  "submitted_to_institution",
  "offer_received",
  "deposit_paid",
  "document_issued",
  "completed",
];

export function admissionStageTone(stageKey: string | null): "neutral" | "approved" | "pending" | "rejected" | "info" {
  if (stageKey === "completed") return "approved";
  if (stageKey === "closed_unsuccessful") return "rejected";
  if (stageKey === "preparing_application") return "info";
  return "pending";
}

/** Mirrors backend/app/modules/admissions/seed.py — same known
 * simplification noted for Leads/Cases (see README). */
export function availableAdmissionTransitions(stageKey: string | null): { key: string; label: string }[] {
  if (!stageKey) return [];
  const idx = ADMISSION_STAGE_ORDER.indexOf(stageKey);
  if (idx === -1 || idx === ADMISSION_STAGE_ORDER.length - 1) return [];

  const nextStage = ADMISSION_STAGE_ORDER[idx + 1];
  const nextLabel = nextStage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return [
    { key: "advance", label: `Advance to ${nextLabel}` },
    { key: "close_unsuccessful", label: "Close — Unsuccessful" },
  ];
}
