import Link from "next/link";

import { DashboardRefresh } from "@/components/dashboard-refresh";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { MemberManagementWorkspace, type MemberManagementRow } from "@/components/member-management-workspace";
import { Notice } from "@/components/notice";
import { requireProfile } from "@/lib/auth/session";
import { koreaBusinessDate } from "@/lib/date/business-date";
import { createClient } from "@/lib/supabase/server";

type Member = { id: string; name: string; phone: string | null; birth_date: string | null; skill_division: string | null; photo_path: string | null; status: "active" | "ended"; fixed_weekdays: number[] | null; memo: string | null; important_memo: string | null };
type Pass = { member_id: string; total_count: number; used_count: number; recommended_use_by: string; status: string };
type RecentLesson = { id: string; member_id: string; lesson_date: string; approved_at: string | null };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; selected?: string; error?: string; success?: string }> }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const [membersResult, passesResult, recordsResult] = await Promise.all([
    supabase.from("members").select("id, name, phone, birth_date, skill_division, photo_path, status, fixed_weekdays, memo, important_memo").order("name"),
    supabase.from("lesson_passes").select("member_id, total_count, used_count, recommended_use_by, status").in("status", ["active", "pending"]).order("created_at", { ascending: false }),
    supabase.from("lesson_records").select("id, member_id, lesson_date, approved_at").eq("status", "approved").order("lesson_date", { ascending: false }).order("approved_at", { ascending: false }).limit(500),
  ]);
  const members = (membersResult.data ?? []) as Member[];
  const passes = (passesResult.data ?? []) as Pass[];
  const passByMember = new Map<string, Pass>();
  for (const pass of passes) if (!passByMember.has(pass.member_id) || pass.status === "active") passByMember.set(pass.member_id, pass);
  const historyByMember = new Map<string, RecentLesson[]>();
  for (const record of (recordsResult.data ?? []) as RecentLesson[]) {
    const records = historyByMember.get(record.member_id) ?? [];
    if (records.length < 3) records.push(record);
    historyByMember.set(record.member_id, records);
  }
  const photoPaths = members.map((member) => member.photo_path).filter((path): path is string => Boolean(path));
  const photoUrlByPath = new Map<string, string>();
  if (photoPaths.length) {
    const { data } = await supabase.storage.from("member-private").createSignedUrls(photoPaths, 600);
    for (const item of data ?? []) if (item.path && item.signedUrl) photoUrlByPath.set(item.path, item.signedUrl);
  }
  const rows: MemberManagementRow[] = members.map((member) => {
    const pass = passByMember.get(member.id);
    const pendingPasses = passes.filter((item) => item.member_id === member.id && item.status === "pending");
    const pendingRemaining = pendingPasses.reduce((sum, item) => sum + item.total_count - item.used_count, 0);
    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
      birthDate: member.birth_date,
      skillDivision: member.skill_division,
      status: member.status,
      photoUrl: member.photo_path ? photoUrlByPath.get(member.photo_path) : undefined,
      fixedWeekdays: member.fixed_weekdays ?? [],
      remaining: pass ? pass.total_count - pass.used_count : null,
      totalCount: pass?.total_count ?? null,
      usedCount: pass?.used_count ?? null,
      recommendedUseBy: pass?.recommended_use_by ?? null,
      recentLessons: historyByMember.get(member.id) ?? [],
      memo: member.memo,
      importantMemo: member.important_memo,
      hasPendingPass: pendingPasses.length > 0,
      pendingRemaining,
    };
  });
  const lowRemainingCount = rows.filter((member) => {
    const totalRemaining = (member.remaining ?? 0) + member.pendingRemaining;
    return totalRemaining > 0 && totalRemaining <= 2 && member.status === "active";
  }).length;
  const today = koreaBusinessDate();
  const todayLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date(`${today}T00:00:00+09:00`));
  const pageError = params.error ?? membersResult.error?.message ?? passesResult.error?.message ?? recordsResult.error?.message;

  return (
    <div className="dashboard-shell members-shell">
      <DashboardSidebar activeHref="/members" profile={profile} />
      <DashboardRefresh />
      <div className="dashboard-workspace">
        <header className="dashboard-topbar members-topbar">
          <div><h1>회원 관리</h1><p>회원의 레슨권과 이용 기록을 빠르게 확인하세요.</p></div>
          <div className="members-topbar-actions">{lowRemainingCount > 0 && <Link href="/members?filter=low" className="members-low-alert">▲ 잔여 횟수 2회 이하 회원 {lowRemainingCount}명 ›</Link>}<time dateTime={today}>{todayLabel}</time><span className="dashboard-user-avatar">{profile.display_name.slice(0, 1)}</span></div>
        </header>
        <main className="members-main">
          <Notice error={pageError} success={params.success} />
          <MemberManagementWorkspace initialFilter={params.filter === "low" ? "low" : "all"} initialQuery={params.q} initialSelectedId={params.selected} rows={rows} />
        </main>
      </div>
    </div>
  );
}
