export const APP_ROLES = ["admin", "coach"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface Profile {
  id: string;
  display_name: string;
  role: AppRole;
  last_login_at: string | null;
}

export function hasAllowedRole(
  profile: Pick<Profile, "role">,
  allowedRoles: readonly AppRole[],
) {
  return allowedRoles.includes(profile.role);
}
