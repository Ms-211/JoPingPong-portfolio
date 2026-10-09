import { describe, expect, it } from "vitest";

import { checkinResultView, type CheckinResult } from "./types";

function result(resultCode: string): CheckinResult {
  return {
    result_code: resultCode,
    member_name: "김회원",
    warning_codes: [],
    request_time: null,
    remaining_count: 5,
  };
}

describe("checkinResultView", () => {
  it("두 번째 QR 요청을 경고 상태로 안내한다", () => {
    expect(checkinResultView(result("second_created"))).toEqual({
      tone: "warning",
      symbol: "!",
      title: "김회원 회원님",
      message: "오늘 두 번째 레슨 요청입니다.",
      status: "승인되면 레슨권이 1회 더 차감됩니다.",
    });
  });

  it("세 번째 QR 요청 차단을 오류 상태로 안내한다", () => {
    expect(checkinResultView(result("daily_limit_reached"))).toEqual({
      tone: "error",
      symbol: "×",
      title: "김회원 회원님",
      message: "오늘 가능한 두 번의 레슨을 모두 이용했습니다.",
      status: "세 번째 QR 요청은 차단되었습니다.",
    });
  });
});
