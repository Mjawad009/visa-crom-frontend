export interface FileRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  folder_id: string | null;
  category: string | null;
  filename: string;
  content_type: string;
  size_bytes: number | null;
  version: number;
  previous_version_id: string | null;
  status: "pending" | "verified" | "rejected" | "superseded";
  rejection_reason: string | null;
  ocr_text: string | null;
  ai_analysis: Record<string, unknown> | null;
  expiry_date: string | null;
  created_at: string;
}

export interface DocumentCategory {
  id: string;
  key: string;
  name: string;
  description: string | null;
  expiry_tracking_enabled: boolean;
}

export function fileStatusTone(status: FileRecord["status"]): "neutral" | "approved" | "pending" | "rejected" | "info" {
  switch (status) {
    case "verified":
      return "approved";
    case "rejected":
      return "rejected";
    case "superseded":
      return "neutral";
    default:
      return "pending";
  }
}
