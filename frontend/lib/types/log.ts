export interface ActivityLog {
  id: string;
  actor_user_id: string | null;
  branch_id: string | null;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  branch_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  created_at: string;
}
