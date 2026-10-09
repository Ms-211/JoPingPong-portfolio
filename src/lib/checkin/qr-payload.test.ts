import { describe, expect, it } from "vitest";

import { tokenFromCheckinQr } from "./qr-payload";

const token = "abcdefghijklmnopqrstuvwxyzABCDEFG123456789_-";

describe("tokenFromCheckinQr", () => {
  it("extracts a token from an issued check-in URL", () => {
    expect(tokenFromCheckinQr(`https://academy.example/checkin?t=${token}`)).toBe(token);
  });

  it("accepts the check-in path with a trailing slash", () => {
    expect(tokenFromCheckinQr(`http://localhost:3000/checkin/?t=${token}`)).toBe(token);
  });

  it.each([
    "not-a-url",
    `https://academy.example/members?t=${token}`,
    "https://academy.example/checkin?t=short",
    `javascript:alert(1)?t=${token}`,
  ])("rejects a non-check-in QR: %s", (value) => {
    expect(tokenFromCheckinQr(value)).toBeNull();
  });
});
