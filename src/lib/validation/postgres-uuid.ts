import { z } from "zod";

export const POSTGRES_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function postgresUuid(message = "올바른 식별자가 아닙니다.") {
  return z.string().regex(POSTGRES_UUID_PATTERN, message);
}
