import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth/session";
import {
  applyRecordFilters,
  csvCell,
  type LessonRecordRow,
  RECORD_STATUS_LABELS,
  REQUEST_METHOD_LABELS,
} from "@/lib/lesson-records";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return new NextResponse("로그인이 필요합니다.", { status: 401 });

  const url = new URL(request.url);
  const filters = Object.fromEntries(url.searchParams.entries());
  const supabase = await createClient();
  let recordsQuery = supabase.from("lesson_records").select("id, member_id, lesson_pass_id, actual_coach_id, request_method, requested_at, lesson_date, daily_sequence, approved_at, approved_by, status, rejected_at, rejection_reason, cancelled_at, cancellation_reason, note").order("lesson_date", { ascending: false }).order("requested_at", { ascending: false }).limit(1000);
  recordsQuery = applyRecordFilters(recordsQuery, filters);
  const [recordsResult, membersResult, staffResult] = await Promise.all([
    recordsQuery,
    supabase.from("members").select("id, name"),
    supabase.from("profiles").select("id, display_name"),
  ]);
  if (recordsResult.error || membersResult.error || staffResult.error) {
    return new NextResponse("기록을 내보내지 못했습니다.", { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
  const memberNames = new Map((membersResult.data ?? []).map((row) => [row.id, row.name]));
  const staffNames = new Map((staffResult.data ?? []).map((row) => [row.id, row.display_name]));
  const header = ["레슨일", "회원", "상태", "요청 방식", "일일 회차", "실제 담당자", "요청·등록 시각", "승인 시각", "레슨권 ID", "메모", "거절 사유", "취소 사유"];
  const rows = ((recordsResult.data ?? []) as LessonRecordRow[]).map((record) => [
    record.lesson_date, memberNames.get(record.member_id) ?? record.member_id, RECORD_STATUS_LABELS[record.status], REQUEST_METHOD_LABELS[record.request_method], record.daily_sequence, record.actual_coach_id ? staffNames.get(record.actual_coach_id) ?? record.actual_coach_id : "", record.requested_at, record.approved_at, record.lesson_pass_id, record.note, record.rejection_reason, record.cancellation_reason,
  ]);
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="lesson-records-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
