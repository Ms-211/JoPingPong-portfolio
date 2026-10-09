import "client-only";

import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env/client";

export function createClient() {
  const clientEnv = getClientEnv();

  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
