import "server-only";

import { redirect } from "next/navigation";

import {
  hasAllowedRole,
  type AppRole,
  type Profile,
} from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, last_login_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function requireProfile(
  allowedRoles: readonly AppRole[] = ["admin", "coach"],
) {
  const profile = await getCurrentProfile();

  if (!profile) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  if (!hasAllowedRole(profile, allowedRoles)) {
    redirect("/dashboard?error=access_denied");
  }

  return profile;
}
