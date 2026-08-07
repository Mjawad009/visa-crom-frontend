export interface Client {
  id: string;
  branch_id: string | null;
  assigned_consultant_id: string | null;
  lead_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}
