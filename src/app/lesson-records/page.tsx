import Link from "next/link";

import { registerPastLesson } from "@/app/lesson-records/actions";
import { DashboardRefresh } from "@/components/dashboard-refresh";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LessonRecordsWorkspace, type LessonRecordWorkspaceRow } from "@/components/lesson-records-workspace";
import { MemberSearchSelect, type SearchableMember } from "@/components/member-search-select";
import { Notice } from "@/components/notice";
import { requireProfile } from "@/lib/auth/session";
import { koreaBusinessDate } from "@/lib/date/business-date";
import { applyRecordFilters, type LessonRecordRow, RECORD_STATUS_LABELS, REQUEST_METHOD_LABELS, type RecordFilters } from "@/lib/lesson-records";
import { createClient } from "@/lib/supabase/server";

type MemberOption = { id: string; name: string; phone: string | null; birth_date: string | null; skill_division: string | null };
type StaffOption = { id: string; display_name: string };

function subtractCalendarMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const targetMonthIndex = month - 1 - months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonthIndex + 1, 0)).getUTCDate();
  return `${targetYear}-${String(normalizedMonthIndex + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export default async function LessonRecordsPage({ searchParams }: { searchParams: Promise<RecordFilters & { error?: string; success?: string }> }) {
  const profile = await requireProfile();
  const filters = await searchParams;
  const today = koreaBusinessDate();
  const effectiveFilters: RecordFilters = {
    ...filters,
    date_from: filters.date_from || subtractCalendarMonths(today, 2),
    date_to: filters.date_to || today,
  };
  const supabase = await createClient();
  let recordsQuery = supabase.from("lesson_records").select("id, member_id, lesson_pass_id, actual_coach_id, request_method, requested_at, lesson_date, daily_sequence, approved_at, approved_by, status, rejected_at, rejection_reason, cancelled_at, cancellation_reason, note, pass_total_count_at_approval, pass_used_count_after_approval, pass_remaining_after_approval").order("lesson_date", { ascending: false }).order("requested_at", { ascending: false }).limit(1000);
  recordsQuery = applyRecordFilters(recordsQuery, effectiveFilters);
  const [recordsResult, membersResult, staffResult] = await Promise.all([
    recordsQuery,
    supabase.from("members").select("id, name, phone, birth_date, skill_division").order("name"),
    supabase.from("profiles").select("id, display_name").order("display_name"),
  ]);
  const records = (recordsResult.data ?? []) as LessonRecordRow[];
  const members = (membersResult.data ?? []) as MemberOption[];
  const staff = (staffResult.data ?? []) as StaffOption[];
  const memberById = new Map(members.map((member) => [member.id, member]));
  const staffNames = new Map(staff.map((person) => [person.id, person.display_name]));
  const searchableMembers: SearchableMember[] = members.map((member) => ({ id: member.id, name: member.name, phone: member.phone, birthDate: member.birth_date, skillDivision: member.skill_division }));
  const query = new URLSearchParams();
  for (const key of ["date_from", "date_to", "member_id", "coach_id", "status", "method"] as const) if (effectiveFilters[key]) query.set(key, effectiveFilters[key]);
  const returnTo = `/lesson-records${query.size ? `?${query}` : ""}`;
  const rows: LessonRecordWorkspaceRow[] = records.map((record) => {
    const member = memberById.get(record.member_id);
    return { id: record.id, memberId: record.member_id, memberName: member?.name ?? "알 수 없음", memberPhone: member?.phone ?? null, memberBirthDate: member?.birth_date ?? null, memberSkillDivision: member?.skill_division ?? null, remainingAfterApproval: record.pass_remaining_after_approval, lessonDate: record.lesson_date, status: record.status, method: record.request_method, dailySequence: record.daily_sequence, coachName: record.actual_coach_id ? staffNames.get(record.actual_coach_id) ?? "알 수 없음" : null, requestedAt: record.requested_at, processedAt: record.approved_at ?? record.rejected_at ?? record.cancelled_at, note: record.note, reason: record.cancellation_reason ?? record.rejection_reason };
  });
  const approvedCount = records.filter((record) => record.status === "approved").length;
  const pendingCount = records.filter((record) => record.status === "pending").length;
  const exceptionCount = records.filter((record) => record.status === "rejected" || record.status === "cancelled").length;
  const todayLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date(`${today}T00:00:00+09:00`));

  return <div className="dashboard-shell records-shell">
    <DashboardSidebar activeHref="/lesson-records" profile={profile} /><DashboardRefresh />
    <div className="dashboard-workspace">
      <header className="dashboard-topbar records-topbar"><div><h1>레슨 기록</h1><p>승인·거절·취소된 모든 레슨 이력을 확인하세요.</p></div><div className="dashboard-topbar-meta"><Link className="records-export-link" href={`/lesson-records/export${query.size ? `?${query}` : ""}`}>CSV 내보내기</Link><time dateTime={today}>{todayLabel}</time><span className="dashboard-user-avatar">{profile.display_name.slice(0, 1)}</span></div></header>
      <main className="records-main">
        <Notice error={filters.error ?? recordsResult.error?.message ?? membersResult.error?.message ?? staffResult.error?.message} success={filters.success} />
        <section className="records-stat-grid"><article><span>▤</span><div><small>조회 기록</small><strong>{records.length}<b>건</b></strong></div></article><article><span>✓</span><div><small>승인 완료</small><strong>{approvedCount}<b>건</b></strong></div></article><article><span>◷</span><div><small>승인 대기</small><strong>{pendingCount}<b>건</b></strong></div></article><article><span>!</span><div><small>거절·취소</small><strong>{exceptionCount}<b>건</b></strong></div></article></section>
        <section className="records-filter-panel"><form method="get"><label>시작일<input name="date_from" type="date" defaultValue={effectiveFilters.date_from} /></label><label>종료일<input name="date_to" type="date" defaultValue={effectiveFilters.date_to} /></label><label>회원 검색<MemberSearchSelect allowAll defaultValue={filters.member_id} members={searchableMembers} /></label><label>담당자<select name="coach_id" defaultValue={filters.coach_id ?? ""}><option value="">전체 담당자</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><label>상태<select name="status" defaultValue={filters.status ?? ""}><option value="">전체 상태</option>{Object.entries(RECORD_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>요청 방식<select name="method" defaultValue={filters.method ?? ""}><option value="">전체 방식</option>{Object.entries(REQUEST_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="submit">조회</button><Link href="/lesson-records">초기화</Link></form></section>
        <LessonRecordsWorkspace admin={profile.role === "admin"} records={rows} returnTo={returnTo} />
        {profile.role === "admin" && <details className="records-past-panel"><summary>누락된 과거 레슨 등록</summary><div><p>장애 등으로 누락된 레슨만 등록합니다. 등록 즉시 활성 레슨권에서 1회 차감됩니다.</p><form action={registerPastLesson}><label>회원 검색<MemberSearchSelect members={searchableMembers} required /></label><label>실제 레슨일<input name="lesson_date" type="date" max={today} required /></label><label>실제 담당자<select name="actual_coach_id" required defaultValue={profile.id}>{staff.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label><label>메모<input name="note" maxLength={500} placeholder="장애 복구 사유 등" /></label><button type="submit">과거 레슨 등록</button></form></div></details>}
      </main>
    </div>
  </div>;
}
