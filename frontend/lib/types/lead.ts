export interface Lead {
  id: string;
  branch_id: string | null;
  assigned_to_user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  country_of_interest: string | null;
  visa_type_interest: string | null;
  notes: string | null;
  is_converted: boolean;
  created_at: string;
  current_stage_key: string | null;
  current_stage_name: string | null;
}

export const LEAD_SOURCES = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "walk_in", label: "Walk-in" },
  { value: "agent", label: "Agent" },
  { value: "other", label: "Other" },
];

export function stageTone(stageKey: string | null): "neutral" | "approved" | "pending" | "rejected" | "info" {
  switch (stageKey) {
    case "converted":
      return "approved";
    case "lost":
      return "rejected";
    case "new":
      return "info";
    default:
      return "pending";
  }
}

/**
 * Mirrors the transitions seeded in backend/app/modules/leads/seed.py.
 * A generic "GET available transitions for this instance" endpoint would
 * remove the need to duplicate this map — worth adding to the Workflow
 * Engine in a later phase once a second module needs the same thing.
 */
export const LEAD_TRANSITIONS: Record<string, { key: string; label: string }[]> = {
  new: [
    { key: "contact", label: "Mark Contacted" },
    { key: "mark_lost", label: "Mark Lost" },
  ],
  contacted: [
    { key: "qualify", label: "Qualify" },
    { key: "mark_lost", label: "Mark Lost" },
  ],
  qualified: [
    { key: "send_proposal", label: "Send Proposal" },
    { key: "mark_lost", label: "Mark Lost" },
  ],
  proposal_sent: [
    { key: "convert", label: "Convert to Client" },
    { key: "mark_lost", label: "Mark Lost" },
  ],
  converted: [],
  lost: [],
};
