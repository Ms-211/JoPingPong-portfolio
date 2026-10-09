import { z } from "zod";

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_URL is required")
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export const siteUrlSchema = z.string().url().transform((value) => new URL(value)).refine((url) => {
  return !url.username && !url.password && (url.protocol === "https:" ||
    (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
}, "SITE_URL은 HTTPS 주소 또는 로컬 개발 주소여야 합니다.").transform((url) => url.origin);

export function parsePublicEnv(input: unknown): PublicEnv {
  return publicEnvSchema.parse(input);
}

