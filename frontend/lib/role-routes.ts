/**
 * Maps a role key to where that role lands after login. Roles not
 * listed here use the general admin-style /dashboard, which is
 * appropriate for CEO/Branch Manager/Finance/etc. Dedicated portals are
 * added one at a time (Consultant Portal — Phase 8, Visa Processing
 * Portal — Phase 9, Admissions — Phase 10, Client Portal — Phase 15).
 */
export const ROLE_HOME_ROUTES: Record<string, string> = {
  consultant: "/portal/consultant",
  visa_processing_officer: "/portal/visa-processing",
  admissions_officer: "/portal/admissions",
};

export function getHomeRoute(roleKey: string | undefined): string {
  if (!roleKey) return "/dashboard";
  return ROLE_HOME_ROUTES[roleKey] ?? "/dashboard";
}
