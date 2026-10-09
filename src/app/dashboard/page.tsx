import Link from "next/link";

import { registerManualCheckin } from "@/app/dashboard/actions";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardRefresh } from "@/components/dashboard-refresh";
import { MemberSearchSelect, type SearchableMember } from "@/components/member-search-select";
import { Notice } from "@/components/notice";
import {
  PendingRequestsTable,
  type PendingRequestRow,
} from "@/components/pending-requests-table";
import { requireProfile } from "@/lib/auth/session";
import { isoWeekday, koreaBusinessDate } from "@/lib/date/business-date";
import { createClient } from "@/lib/supabase/server";
import { isPendingWarningTime } from "@/lib/operations/pending-warning";

type Member = {
  id: string;
  name: string;
  phone: string | null;
  birth_date: string | null;
  skill_division: string | null;
  photo_path: string | null;
  fixed_weekdays: number[];
  status: "active" | "ended";
  important_memo: string | null;
};

type LessonPass = {
  id: string;
  member_id: string;
  total_count: number;
  used_count: number;
  recommended_use_by: string;
  status: string;
};

type LessonRecord = {
  id: string;
  member_id: string;
  lesson_pass_id: string | null;
  request_method: "qr" | "coach_manual" | "outage_recovery";
  requested_at: string;
  approved_at: string | null;
  actual_coach_id: string | null;
  approved_by: string | null;
  lesson_date: string;
  status: "pending" | "approved";
};

const METHOD_LABELS = {
  qr: "QR",
  coach_manual: "코치 직접",
  outage_recovery: "장애 복구",
} as const;

const WEEKDAY_LABELS = ["", "월", "화", "수", "목", "금", "토", "일"] as const;

function remaining(pass: LessonPass | undefined) {
  return pass ? pass.total_count - pass.used_count : 0;
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
      86400000,
  );
}

function memberWarnings(
  member: Member,
  pass: LessonPass | undefined,
  totalRemaining: number,
  today: string,
  weekday: number,
  hasPendingToday: boolean,
) {
  const warnings: string[] = [];

  if (totalRemaining === 0) warnings.push("등록 필요");
  if (totalRemaining > 0 && totalRemaining <= 2) warnings.push("전체 잔여 2회 이하");
  if (pass && pass.recommended_use_by < today) warnings.push("권장 소진일 경과");
  if (
    pass &&
    pass.recommended_use_by >= today &&
    daysBetween(today, pass.recommended_use_by) <= 7
  ) warnings.push("권장 소진일 임박");
  if (member.important_memo) warnings.push("중요 메모");
  if (hasPendingToday && !member.fixed_weekdays.includes(weekday)) warnings.push("다른 요일 방문");

  return warnings;
}

function displayRequestDateTime(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  const dateParts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const timeParts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const dateValue = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((part) => part.type === type)?.value ?? "";
  const timeValue = (type: Intl.DateTimeFormatPartTypes) =>
    timeParts.find((part) => part.type === type)?.value ?? "";

  return `${dateValue("year")}.${dateValue("month")}.${dateValue("day")}(${dateValue("weekday")}) ${timeValue("dayPeriod")} ${timeValue("hour")}:${timeValue("minute")}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; member?: string }>;
}) {
  const profile = await requireProfile();
  const messages = await searchParams;
  const today = koreaBusinessDate();
  const weekday = isoWeekday(today);
  const weekdayLabel = WEEKDAY_LABELS[weekday];
  const supabase = await createClient();
  const [membersResult, passesResult, pendingRecordsResult, todayApprovedResult, recentRecordsResult] =
    await Promise.all([
      supabase
        .from("members")
        .select("id, name, phone, birth_date, skill_division, photo_path, fixed_weekdays, status, important_memo")
        .neq("status", "ended")
        .order("name"),
      supabase
        .from("lesson_passes")
        .select("id, member_id, total_count, used_count, recommended_use_by, status")
        .in("status", ["active", "pending"]),
      supabase
        .from("lesson_records")
        .select("id, member_id, lesson_pass_id, request_method, requested_at, approved_at, actual_coach_id, approved_by, lesson_date, status")
        .eq("status", "pending")
        .order("requested_at"),
      supabase
        .from("lesson_records")
        .select("id, member_id, lesson_pass_id, request_method, requested_at, approved_at, actual_coach_id, approved_by, lesson_date, status")
        .eq("lesson_date", today)
        .eq("status", "approved")
        .order("approved_at"),
      supabase
        .from("lesson_records")
        .select("member_id, lesson_date")
        .eq("status", "approved")
        .lt("lesson_date", today)
        .order("lesson_date", { ascending: false })
        .limit(500),
    ]);

  const members = (membersResult.data ?? []) as Member[];
  const searchableMembers: SearchableMember[] = members.map((member) => ({
    id: member.id,
    name: member.name,
    phone: member.phone,
    birthDate: member.birth_date,
    skillDivision: member.skill_division,
  }));
  const selectedMemberId = members.some((member) => member.id === messages.member) ? messages.member : "";
  const passes = (passesResult.data ?? []) as LessonPass[];
  const pendingRecords = (pendingRecordsResult.data ?? []) as LessonRecord[];
  const completedRecords = (todayApprovedResult.data ?? []) as LessonRecord[];
  const todayRecords = [
    ...pendingRecords.filter((record) => record.lesson_date === today),
    ...completedRecords,
  ];
  const previousDayPendingCount = pendingRecords.filter((record) => record.lesson_date < today).length;
  const showClosingWarning = pendingRecords.length > 0 && isPendingWarningTime(
    process.env.PENDING_WARNING_TIME_KST,
  );
  const memberById = new Map(members.map((member) => [member.id, member]));
  const activePasses = passes.filter((pass) => pass.status === "active");
  const passByMember = new Map(activePasses.map((pass) => [pass.member_id, pass]));
  const totalRemainingByMember = new Map<string, number>();
  for (const pass of passes) totalRemainingByMember.set(pass.member_id, (totalRemainingByMember.get(pass.member_id) ?? 0) + remaining(pass));
  const recordByMember = new Map(todayRecords.map((record) => [record.member_id, record]));
  const recentLessonByMember = new Map<string, string>();

  for (const record of recentRecordsResult.data ?? []) {
    if (!recentLessonByMember.has(record.member_id)) {
      recentLessonByMember.set(record.member_id, record.lesson_date);
    }
  }

  const expectedMembers = members.filter(
    (member) => member.status === "active" && member.fixed_weekdays.includes(weekday),
  );
  const pendingPhotoPaths = pendingRecords
    .map((record) => memberById.get(record.member_id)?.photo_path)
    .filter((path): path is string => Boolean(path));
  const photoUrlByPath = new Map<string, string>();

  if (pendingPhotoPaths.length > 0) {
    const { data } = await supabase.storage
      .from("member-private")
      .createSignedUrls(pendingPhotoPaths, 600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) photoUrlByPath.set(item.path, item.signedUrl);
    }
  }

  const pageError =
    messages.error ??
    membersResult.error?.message ??
    passesResult.error?.message ??
    pendingRecordsResult.error?.message ??
    todayApprovedResult.error?.message;
  const pendingRows: PendingRequestRow[] = pendingRecords.flatMap((record) => {
    const member = memberById.get(record.member_id);
    if (!member) return [];
    const pass = passByMember.get(member.id);
    return [{
      id: record.id,
      memberId: member.id,
      memberName: member.name,
      photoUrl: member.photo_path ? photoUrlByPath.get(member.photo_path) : undefined,
      requestTime: displayRequestDateTime(record.requested_at),
      method: METHOD_LABELS[record.request_method],
      remaining: remaining(pass),
      warnings: [
        ...(record.lesson_date < today ? [`${record.lesson_date} 미처리 요청`] : []),
        ...memberWarnings(member, pass, totalRemainingByMember.get(member.id) ?? 0, today, weekday, true),
      ],
    }];
  });

  const lowPassMembers = members.filter((member) => {
    const count = totalRemainingByMember.get(member.id) ?? 0;
    return member.status === "active" && count > 0 && count <= 2;
  });
  const paymentNeededCount = members.filter(
    (member) => member.status === "active" && (totalRemainingByMember.get(member.id) ?? 0) === 0,
  ).length;
  const overdueRecommendedCount = activePasses.filter((pass) => pass.recommended_use_by < today).length;
  const todayOverviewMembers = [...expectedMembers];
  for (const record of completedRecords) {
    const member = memberById.get(record.member_id);
    if (member && !todayOverviewMembers.some((item) => item.id === member.id)) {
      todayOverviewMembers.push(member);
    }
  }
  const todayLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${today}T00:00:00+09:00`));

  return (
    <div className="dashboard-shell">
      <DashboardSidebar profile={profile} />
      <DashboardRefresh />
      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <div>
            <h1>대시보드</h1>
            <p>오늘의 레슨 현황을 확인하세요</p>
          </div>
          <div className="dashboard-topbar-meta">
            <time dateTime={today}>{todayLabel}</time>
            <span className="dashboard-user-avatar">{profile.display_name.slice(0, 1)}</span>
          </div>
        </header>

        <main className="dashboard-main-v2">
          <Notice error={pageError} success={messages.success} />
          {previousDayPendingCount > 0 && <p className="notice error-notice">전날까지 미처리된 승인 요청 {previousDayPendingCount}건이 있습니다. 오늘 반드시 확인해 주세요.</p>}
          {showClosingWarning && <p className="notice error-notice">마감 시각이 지났지만 승인 대기 요청 {pendingRecords.length}건이 남아 있습니다.</p>}

          <section className="dashboard-metric-grid" aria-label="오늘의 요약">
            <article className="dashboard-metric">
              <span className="dashboard-metric-icon people">◎</span>
              <div><span>오늘 레슨 예정자</span><strong>{expectedMembers.length}<small>명</small></strong></div>
            </article>
            <Link className="dashboard-metric pending" href="/approvals">
              <span className="dashboard-metric-icon timer">◷</span>
              <div><span>승인 대기</span><strong>{pendingRecords.length}<small>건</small></strong></div>
            </Link>
            <Link className="dashboard-metric" href={`/lesson-records?date_from=${today}&date_to=${today}&status=approved`}>
              <span className="dashboard-metric-icon complete">✓</span>
              <div><span>승인 완료</span><strong>{completedRecords.length}<small>건</small></strong></div>
            </Link>
            <Link className="dashboard-metric warning" href="/lesson-passes">
              <span className="dashboard-metric-icon alert">!</span>
              <div><span>잔여 2회 이하</span><strong>{lowPassMembers.length}<small>명</small></strong></div>
            </Link>
          </section>

          <div className="dashboard-primary-grid">
            <section className="dashboard-panel dashboard-approval-panel">
              <div className="dashboard-panel-heading">
                <h2>승인 대기 <span>{pendingRecords.length}</span></h2>
                <p>요청을 확인한 뒤 승인하거나 거절하세요.</p>
              </div>
              <PendingRequestsTable compact rows={pendingRows.slice(0, 5)} totalCount={pendingRows.length} />
            </section>

            <section className="dashboard-panel dashboard-manual-panel" id="manual-checkin">
              <div className="dashboard-panel-heading"><h2>직접 출석 등록</h2><p>QR 인식이 어렵거나 하루 두 번째 레슨을 확인한 경우 사용합니다.</p></div>
              <form action={registerManualCheckin}>
                <label>회원 검색<MemberSearchSelect defaultValue={selectedMemberId} layout="compact" members={searchableMembers} required /></label>
                <button type="submit">승인 대기 등록</button>
              </form>
            </section>
          </div>

          <div className="dashboard-secondary-grid">
            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <h2>오늘 레슨 예정자</h2>
                <div className="dashboard-heading-actions">
                  <span>{weekdayLabel}요일 레슨 예정자</span>
                  <Link href="/members">회원 전체 보기</Link>
                </div>
              </div>
              <div className="dashboard-today-list">
                {todayOverviewMembers.map((member) => {
                  const record = recordByMember.get(member.id);
                  const state = record?.status === "approved" ? "완료" : record?.status === "pending" ? "승인 대기" : remaining(passByMember.get(member.id)) === 0 ? "결제 필요" : "방문 예정";
                  return (
                    <article key={member.id}>
                      <span className="dashboard-list-avatar">{member.name.slice(0, 1)}</span>
                      <div><Link href={`/members/${member.id}`}>{member.name}</Link><small>잔여 {remaining(passByMember.get(member.id))}회 · 최근 레슨 {recentLessonByMember.get(member.id) ?? "없음"}</small></div>
                      <span className={`dashboard-state ${record?.status ?? "expected"}`}>{state}</span>
                    </article>
                  );
                })}
                {!todayOverviewMembers.length && <p className="dashboard-empty">오늘 고정 요일 예정자가 없습니다.</p>}
              </div>
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel-heading"><h2>확인 필요</h2></div>
              <div className="dashboard-attention-list">
                <Link href="/lesson-passes"><span className="attention-icon orange">!</span><strong>레슨권 2회 이하 회원</strong><b>{lowPassMembers.length}명</b><i>›</i></Link>
                <Link href="/lesson-passes"><span className="attention-icon red">◷</span><strong>권장 소진일 경과</strong><b>{overdueRecommendedCount}명</b><i>›</i></Link>
                <Link href="/approvals"><span className="attention-icon blue">▤</span><strong>미처리 요청</strong><b>{pendingRecords.length}건</b><i>›</i></Link>
                <Link href="/lesson-passes"><span className="attention-icon gray">₩</span><strong>결제 필요 회원</strong><b>{paymentNeededCount}명</b><i>›</i></Link>
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
