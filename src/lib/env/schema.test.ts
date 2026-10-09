import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "./schema";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
};

describe("parsePublicEnv", () => {
  it("accepts valid public Supabase settings", () => {
    expect(parsePublicEnv(validEnv)).toEqual(validEnv);
  });

  it("rejects a missing publishable key", () => {
    expect(() =>
      parsePublicEnv({
        ...validEnv,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
      }),
    ).toThrow();
  });

  it("rejects an invalid Supabase URL", () => {
    expect(() =>
      parsePublicEnv({
        ...validEnv,
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toThrow();
  });
});

