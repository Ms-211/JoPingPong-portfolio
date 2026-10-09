import { describe, expect, it } from "vitest";

import { isoWeekday, koreaBusinessDate } from "./business-date";

describe("Korea business dates", () => {
  it("uses the next Korean date before UTC midnight", () => {
    expect(koreaBusinessDate(new Date("2026-08-08T15:30:00Z"))).toBe("2026-08-09");
  });

  it("returns ISO weekday numbers", () => {
    expect(isoWeekday("2026-08-09")).toBe(7);
    expect(isoWeekday("2026-08-10")).toBe(1);
  });
});
