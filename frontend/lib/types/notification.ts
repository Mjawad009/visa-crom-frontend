export interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function notificationTone(type: string): "neutral" | "approved" | "pending" | "rejected" | "info" {
  if (type === "success") return "approved";
  if (type === "warning") return "pending";
  if (type === "error") return "rejected";
  if (type === "info") return "info";
  return "neutral";
}
