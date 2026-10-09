import "server-only";

import { parsePublicEnv, siteUrlSchema } from "./schema";

export function getSiteOrigin() {
  return siteUrlSchema.parse(process.env.SITE_URL);
}

export function getServerEnv() {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
