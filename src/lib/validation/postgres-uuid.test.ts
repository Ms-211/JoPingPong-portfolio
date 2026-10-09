import { describe, expect, it } from "vitest";

import { postgresUuid } from "./postgres-uuid";

describe("postgresUuid", () => {
  it("accepts UUID values used by deterministic seed data", () => {
    expect(postgresUuid().safeParse("20000000-0000-0000-0000-000000000003").success).toBe(true);
  });

  it("accepts UUID values generated for real members", () => {
    expect(postgresUuid().safeParse("c79a7602-7101-4bc3-93f1-6a32732e5870").success).toBe(true);
  });

  it("rejects malformed identifiers", () => {
    expect(postgresUuid().safeParse("member-3").success).toBe(false);
  });
});
