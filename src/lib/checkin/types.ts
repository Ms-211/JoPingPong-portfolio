export type CheckinResult = {
  result_code: string;
  member_name: string | null;
  warning_codes: string[];
  request_time: string | null;
  remaining_count: number | null;
};

export type CheckinResultView = {
  tone: "idle" | "success" | "info" | "warning" | "error";
  symbol: string;
  title: string;
  message: string;
  status: string;
};

export const IDLE_CHECKIN_VIEW: CheckinResultView = {
  tone: "idle",
  symbol: "⌁",
  title: "QR 인식 대기 중",
  message: "회원 QR 코드를 보여주세요.",
  status: "인식되면 출석 요청이 전송됩니다.",
};

export const CHECKIN_REQUEST_ERROR_VIEW: CheckinResultView = {
  tone: "error",
  symbol: "×",
  title: "요청 처리 실패",
  message: "출석 요청을 처리하지 못했습니다.",
  status: "잠시 후 QR을 다시 보여주세요.",
};

export const INVALID_SCANNED_QR_VIEW: CheckinResultView = {
  tone: "error",
  symbol: "×",
  title: "출석용 QR이 아닙니다.",
  message: "회원 출석 카드를 다시 확인해 주세요.",
  status: "문제가 계속되면 관장님께 문의해 주세요.",
};

export const WARNING_LABELS: Record<string, string> = {
  ended: "현재 이용 종료 상태입니다.",
  no_remaining: "사용 가능한 레슨 횟수가 없습니다.",
  low_remaining: "남은 레슨이 2회 이하입니다.",
  recommended_date_passed: "권장 소진일이 지났습니다.",
};

export function checkinResultView(result: CheckinResult): CheckinResultView {
  switch (result.result_code) {
    case "rate_limited":
      return { tone: "warning", symbol: "!", title: "요청이 너무 많습니다.", message: "잠시 후 다시 요청해 주세요.", status: "최대 1분 후 다시 이용할 수 있습니다." };
    case "created":
      return { tone: "success", symbol: "✓", title: `${result.member_name} 회원님`, message: "출석 요청이 완료되었습니다.", status: "관장님 승인 대기 중" };
    case "second_created":
      return { tone: "warning", symbol: "!", title: `${result.member_name} 회원님`, message: "오늘 두 번째 레슨 요청입니다.", status: "승인되면 레슨권이 1회 더 차감됩니다." };
    case "already_pending":
      return { tone: "info", symbol: "i", title: `${result.member_name} 회원님`, message: "이미 승인 대기 중입니다.", status: "관장님 확인을 기다려 주세요." };
    case "already_approved":
      return { tone: "warning", symbol: "!", title: `${result.member_name} 회원님`, message: "오늘 레슨 처리가 이미 완료되었습니다.", status: "추가 레슨은 관장님께 문의해 주세요." };
    case "daily_limit_reached":
      return { tone: "error", symbol: "×", title: `${result.member_name} 회원님`, message: "오늘 가능한 두 번의 레슨을 모두 이용했습니다.", status: "세 번째 QR 요청은 차단되었습니다." };
    case "inactive_qr":
      return { tone: "error", symbol: "×", title: "사용이 중지된 QR입니다.", message: "QR 정보를 확인하지 못했습니다.", status: "관장님께 새 QR을 요청해 주세요." };
    default:
      return { tone: "error", symbol: "×", title: "등록되지 않은 QR입니다.", message: "QR을 다시 확인해 주세요.", status: "문제가 계속되면 관장님께 문의해 주세요." };
  }
}

export function checkinWarningLabels(codes: string[]) {
  return codes.map((code) => WARNING_LABELS[code]).filter(Boolean);
}
