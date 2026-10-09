import { describe, expect, it } from "vitest";
import { csvCell } from "./lesson-records";
import { tokenFromCheckinQr } from "./checkin/qr-payload";
import { checkinResultView } from "./checkin/types";
import { siteUrlSchema } from "./env/schema";

describe("공개 전 보안 회귀", () => {
  it("CSV 구분자를 보존하면서 수식 시작을 중화한다", () => {
    expect(csvCell('메모, "인용"')).toBe('"메모, ""인용"""');
    expect(csvCell(null)).toBe('""');
    for (const text of ["=1+1", "+1", "-1", "@SUM(1)", " \t=1", "\r=1", "\n메모", "\t메모", "＝1"]) {
      expect(csvCell(text)).toBe(`"'${text}"`);
    }
    expect(csvCell("정상 메모")).toBe('"정상 메모"');
  });

  it("기존 QR과 서버로 전송되지 않는 fragment QR을 인식한다", () => {
    const token = "a".repeat(43);
    expect(tokenFromCheckinQr(`https://example.com/checkin?t=${token}`)).toBe(token);
    expect(tokenFromCheckinQr(`https://example.com/checkin#t=${token}`)).toBe(token);
    expect(tokenFromCheckinQr(`https://example.com/checkin#t=short`)).toBeNull();
    expect(tokenFromCheckinQr(`https://example.com/other#t=${token}`)).toBeNull();
  });

  it("요청 제한 응답은 회원 정보를 표시하지 않는다", () => {
    const view = checkinResultView({ result_code: "rate_limited", member_name: null, warning_codes: [], request_time: null, remaining_count: null });
    expect(view.tone).toBe("warning");
    expect(view.title).toBe("요청이 너무 많습니다.");
  });

  it("QR 기준 주소는 HTTPS 또는 로컬 HTTP만 허용한다", () => {
    expect(siteUrlSchema.parse("https://example.com/path")).toBe("https://example.com");
    expect(siteUrlSchema.parse("http://localhost:3000")).toBe("http://localhost:3000");
    for (const url of ["not-url", "http://example.com", "https://user:pass@example.com", "javascript:alert(1)"]) {
      expect(siteUrlSchema.safeParse(url).success).toBe(false);
    }
  });
});
