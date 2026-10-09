"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { Profile } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=invalid_credentials");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    redirect("/login?error=invalid_credentials");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, display_name, role, last_login_at")
    .eq("id", data.user.id)
    .maybeSingle();
  const profile = profileData as Profile | null;

  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  await supabase.rpc("record_login");
  redirect("/dashboard");
}
