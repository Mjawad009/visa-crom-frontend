export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

export interface BranchCreatePayload {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface BranchUpdatePayload {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
}
