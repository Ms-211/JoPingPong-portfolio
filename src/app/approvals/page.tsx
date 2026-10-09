import { ApprovalWorkspace, type ApprovalWorkspaceRow } from "@/components/approval-workspace";
import { DashboardRefresh } from "@/components/dashboard-refresh";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Notice } from "@/components/notice";
import { requireProfile } from "@/lib/auth/session";
import { koreaBusinessDate } from "@/lib/date/business-date";
import { createClient } from "@/lib/supabase/server";

type Member = { id: string; name: string; phone: string | null; birth_date: string | null; skill_division: string | null; photo_path: string | null; status: "active" | "ended"; memo: string | null; important_memo: string | null };
type Pass = { member_id: string; total_count: number; used_count: number; paid_at: string; recommended_use_by: string; status: string };
type RecordRow = {
  id: string;
  member_id: string;
  request_method: "qr" | "coach_manual" | "outage_recovery";
  requested_at: string;
  lesson_date: string;
  status: "pending" | "approved" | "rejected";
  pass_total_count_at_approval: number | null;
  pass_used_count_after_approval: number | null;
  pass_remaining_after_approval: number | null;
};

const METHOD_LABELS = { qr: "QR 요청", coach_manual: "직접 등록", outage_recovery: "장애 복구" } as const;

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
}

function dateLabel(value: string) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}.${part("month")}.${part("day")}(${part("weekday")})`;
}

function agoLabel(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  return `${Math.floor(minutes / 60)}시간 전`;
}

function recentLessonLabel(lessonDate: string, approvedAt: string | null, requestedAt: string) {
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(`${lessonDate}T00:00:00+09:00`));
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(approvedAt ?? requestedAt));
  return `${lessonDate}(${weekday}) ${time}`;
}

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const profile = await requireProfile();
  const messages = await searchParams;
  const today = koreaBusinessDate();
  const supabase = await createClient();
  const [membersResult, passesResult, pendingResult, processedResult, recentResult] = await Promise.all([
    supabase.from("members").select("id, name, phone, birth_date, skill_division, photo_path, status, memo, important_memo").order("name"),
    supabase.from("lesson_passes").select("member_id, total_count, used_count, paid_at, recommended_use_by, status").in("status", ["active", "pending"]).order("created_at", { ascending: false }),
    supabase.from("lesson_records").select("id, member_id, request_method, requested_at, lesson_date, status, pass_total_count_at_approval, pass_used_count_after_approval, pass_remaining_after_approval").eq("status", "pending").order("requested_at", { ascending: false }),
    supabase.from("lesson_records").select("id, member_id, request_method, requested_at, lesson_date, status, pass_total_count_at_approval, pass_used_count_after_approval, pass_remaining_after_approval").eq("lesson_date", today).in("status", ["approved", "rejected"]).order("requested_at", { ascending: false }),
    supabase.from("lesson_records").select("id, member_id, lesson_date, approved_at, requested_at").eq("status", "approved").order("approved_at", { ascending: false }).limit(500),
  ]);
  const members = (membersResult.data ?? []) as Member[];
  const passes = (passesResult.data ?? []) as Pass[];
  const records = [...((pendingResult.data ?? []) as RecordRow[]), ...((processedResult.data ?? []) as RecordRow[])];
  const memberById = new Map(members.map((member) => [member.id, member]));
  const passByMember = new Map<string, Pass>();
  for (const pass of passes) if (!passByMember.has(pass.member_id) || pass.status === "active") passByMember.set(pass.member_id, pass);
  const totalRemainingByMember = new Map<string, number>();
  for (const item of passes) totalRemainingByMember.set(item.member_id, (totalRemainingByMember.get(item.member_id) ?? 0) + item.total_count - item.used_count);
  const historyByMember = new Map<string, Array<{ id: string; label: string }>>();
  for (const record of recentResult.data ?? []) {
    const lessons = historyByMember.get(record.member_id) ?? [];
    if (lessons.length < 3) lessons.push({
      id: record.id,
      label: recentLessonLabel(record.lesson_date, record.approved_at, record.requested_at),
    });
    historyByMember.set(record.member_id, lessons);
  }
  const photoPaths = [...new Set(records.map((record) => memberById.get(record.member_id)?.photo_path).filter((path): path is string => Boolean(path)))];
  const photoUrlByPath = new Map<string, string>();
  if (photoPaths.length) {
    const { data } = await supabase.storage.from("member-private").createSignedUrls(photoPaths, 600);
    for (const item of data ?? []) if (item.path && item.signedUrl) photoUrlByPath.set(item.path, item.signedUrl);
  }
  const rows: ApprovalWorkspaceRow[] = records.flatMap((record) => {
    const member = memberById.get(record.member_id);
    if (!member) return [];
    const pass = passByMember.get(member.id);
    const currentRemaining = pass ? pass.total_count - pass.used_count : 0;
    const hasApprovalSnapshot = record.status === "approved" && record.pass_remaining_after_approval !== null;
    const remaining = hasApprovalSnapshot ? record.pass_remaining_after_approval! : currentRemaining;
    const usedCount = hasApprovalSnapshot ? record.pass_used_count_after_approval! : (pass?.used_count ?? 0);
    const totalCount = hasApprovalSnapshot ? record.pass_total_count_at_approval! : (pass?.total_count ?? 0);
    const totalRemaining = totalRemainingByMember.get(member.id) ?? 0;
    const warnings = [
      ...(totalRemaining === 0 ? ["등록이 필요한 회원입니다."] : []),
      ...(totalRemaining > 0 && totalRemaining <= 2 ? [`전체 잔여 레슨이 ${totalRemaining}회입니다.`] : []),
      ...(member.status !== "active" ? ["현재 활동 중인 회원이 아닙니다."] : []),
    ];
    return [{
      id: record.id, memberId: member.id, memberName: member.name, phone: member.phone,
      birthDate: member.birth_date, skillDivision: member.skill_division,
      photoUrl: member.photo_path ? photoUrlByPath.get(member.photo_path) : undefined,
      memberStatus: member.status, memo: member.memo, importantMemo: member.important_memo,
      requestDate: dateLabel(record.requested_at),
      requestTime: timeLabel(record.requested_at), requestAgo: agoLabel(record.requested_at),
      method: METHOD_LABELS[record.request_method], status: record.status, remaining,
      usedCount, totalCount,
      paidAt: pass?.paid_at ?? null, recommendedUseBy: pass?.recommended_use_by ?? null,
      recentLessons: historyByMember.get(member.id) ?? [], warnings,
    }];
  });
  const todayLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date(`${today}T00:00:00+09:00`));
  const pageError = messages.error ?? membersResult.error?.message ?? passesResult.error?.message ?? pendingResult.error?.message ?? processedResult.error?.message;

  return (
    <div className="dashboard-shell approvals-shell">
      <DashboardSidebar activeHref="/approvals" profile={profile} />
      <DashboardRefresh />
      <div className="dashboard-workspace">
        <header className="dashboard-topbar approvals-topbar">
          <div><h1>승인 대기</h1><p>QR 출석 요청을 확인하고 승인해 주세요.</p></div>
          <div className="dashboard-topbar-meta"><time dateTime={today}>{todayLabel}</time><span className="dashboard-user-avatar">{profile.display_name.slice(0, 1)}</span></div>
        </header>
        <main className="approvals-main">
          <Notice error={pageError} success={messages.success} />
          <ApprovalWorkspace rows={rows} />
        </main>
      </div>
    </div>
  );
}
