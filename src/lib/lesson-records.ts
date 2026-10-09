export const RECORD_STATUS_LABELS = {
  pending: "승인 대기",
  approved: "승인",
  rejected: "거절",
  cancelled: "승인 취소",
} as const;

export const REQUEST_METHOD_LABELS = {
  qr: "QR",
  coach_manual: "코치 직접",
  outage_recovery: "장애 복구",
} as const;

export type RecordStatus = keyof typeof RECORD_STATUS_LABELS;
export type RequestMethod = keyof typeof REQUEST_METHOD_LABELS;

export type LessonRecordRow = {
  id: string;
  member_id: string;
  lesson_pass_id: string | null;
  actual_coach_id: string | null;
  request_method: RequestMethod;
  requested_at: string;
  lesson_date: string;
  daily_sequence: number | null;
  approved_at: string | null;
  approved_by: string | null;
  status: RecordStatus;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  note: string | null;
  pass_total_count_at_approval: number | null;
  pass_used_count_after_approval: number | null;
  pass_remaining_after_approval: number | null;
};

export type RecordFilters = {
  date_from?: string;
  date_to?: string;
  member_id?: string;
  coach_id?: string;
  status?: string;
  method?: string;
};

export function applyRecordFilters<T extends {
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
  eq(column: string, value: string): T;
}>(query: T, filters: RecordFilters) {
  let filtered = query;
  if (filters.date_from) filtered = filtered.gte("lesson_date", filters.date_from);
  if (filters.date_to) filtered = filtered.lte("lesson_date", filters.date_to);
  if (filters.member_id) filtered = filtered.eq("member_id", filters.member_id);
  if (filters.coach_id) filtered = filtered.eq("actual_coach_id", filters.coach_id);
  if (filters.status && filters.status in RECORD_STATUS_LABELS) filtered = filtered.eq("status", filters.status);
  if (filters.method && filters.method in REQUEST_METHOD_LABELS) filtered = filtered.eq("request_method", filters.method);
  return filtered;
}

export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const safeText = /^[\s\uFEFF]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}
