export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface Permission {
  id: string;
  key: string;
  module: string;
  description: string | null;
}

/** Groups a flat permission list into { module: Permission[] } for checklist UIs. */
export function groupPermissionsByModule(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    (acc[perm.module] ??= []).push(perm);
    return acc;
  }, {});
}
