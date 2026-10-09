import { describe, expect, it } from "vitest";

import { isPendingWarningTime, parsePendingWarningTime } from "./pending-warning";

describe("pending close warning", () => {
  it("accepts only 24-hour HH:MM values", () => {
    expect(parsePendingWarningTime("21:30")).toEqual({ hour: 21, minute: 30 });
    expect(parsePendingWarningTime("24:00")).toBeNull();
    expect(parsePendingWarningTime(undefined)).toBeNull();
  });

  it("compares against Korea time", () => {
    const now = new Date("2026-08-11T12:15:00Z");
    expect(isPendingWarningTime("21:00", now)).toBe(true);
    expect(isPendingWarningTime("21:30", now)).toBe(false);
  });
});

