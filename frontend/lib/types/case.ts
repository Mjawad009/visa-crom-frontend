export interface Case {
  id: string;
  client_id: string;
  branch_id: string | null;
  assigned_consultant_id: string | null;
  reference: string;
  case_type: string;
  destination_country: string | null;
  visa_type: string | null;
  priority: string;
  target_submission_date: string | null;
  notes: string | null;
  is_closed: boolean;
  closed_reason: string | null;
  created_at: string;
  current_stage_key: string | null;
  current_stage_name: string | null;
  client_full_name: string | null;
}

export const CASE_STAGE_ORDER = [
  "consultation",
  "document_collection",
  "eligibility_review",
  "application",
  "submission",
  "biometrics",
  "medical",
  "interview",
  "decision",
  "post_visa_support",
];

export function caseStageTone(stageKey: string | null): "neutral" | "approved" | "pending" | "rejected" | "info" {
  if (stageKey === "post_visa_support") return "approved";
  if (stageKey === "closed_unsuccessful") return "rejected";
  if (stageKey === "consultation") return "info";
  return "pending";
}

/**
 * Mirrors backend/app/modules/cases/seed.py: "advance" moves to the next
 * stage in CASE_STAGE_ORDER, "close_unsuccessful" is available from any
 * non-terminal stage. Same known simplification as Leads (see README) —
 * worth replacing with a live "available transitions" endpoint once a
 * third module needs the same lookup.
 */
export function availableCaseTransitions(stageKey: string | null): { key: string; label: string }[] {
  if (!stageKey) return [];
  if (stageKey === "closed_unsuccessful") return [{ key: "reopen", label: "Reopen" }];
  const idx = CASE_STAGE_ORDER.indexOf(stageKey);
  if (idx === -1 || idx === CASE_STAGE_ORDER.length - 1) return []; // terminal stages: no actions

  const actions = [{ key: "close_unsuccessful", label: "Close — Unsuccessful" }];
  const nextStage = CASE_STAGE_ORDER[idx + 1];
  const nextLabel = nextStage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return [{ key: "advance", label: `Advance to ${nextLabel}` }, ...actions];
}
