export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role_id: string;
  branch_id: string | null;
  is_active: boolean;
  additional_role_ids: string[];
}

export interface UserCreatePayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role_id: string;
  branch_id?: string;
  additional_role_ids?: string[];
}

export interface UserUpdatePayload {
  full_name?: string;
  email?: string;
  phone?: string;
  role_id?: string;
  branch_id?: string | null;
  is_active?: boolean;
  additional_role_ids?: string[];
}
