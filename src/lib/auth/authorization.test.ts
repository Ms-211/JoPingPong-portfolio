import { describe, expect, it } from "vitest";

import { hasAllowedRole, type Profile } from "./authorization";

const activeCoach: Profile = {
  id: "00000000-0000-0000-0000-000000000001",
  display_name: "테스트 코치",
  role: "coach",
  last_login_at: null,
};

describe("hasAllowedRole", () => {
  it("allows a profile with an accepted role", () => {
    expect(hasAllowedRole(activeCoach, ["admin", "coach"])).toBe(true);
  });

  it("rejects a role outside the accepted roles", () => {
    expect(hasAllowedRole(activeCoach, ["admin"])).toBe(false);
  });
});
