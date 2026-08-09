export interface CommunicationLog {
  id: string;
  entity_type: string;
  entity_id: string;
  channel: "email" | "internal_note";
  direction: "outbound" | "internal";
  sender_user_id: string | null;
  recipient_email: string | null;
  subject: string | null;
  body: string;
  created_at: string;
}
