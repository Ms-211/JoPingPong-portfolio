import Link from "next/link";

import { manuallyExpireLessonPass } from "@/app/lesson-passes/actions";
import { DashboardRefresh } from "@/components/dashboard-refresh";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LessonPassRegistrationModal, type LessonPassRegistrationMember } from "@/components/lesson-pass-registration-modal";
import { LessonPassEditModal } from "@/components/lesson-pass-edit-modal";
import { Notice } from "@/components/notice";
import { requireProfile } from "@/lib/auth/session";
import { koreaBusinessDate } from "@/lib/date/business-date";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS = {
  pending: "사용 예정",
  active: "사용 중",
  exhausted: "소진",
  expired: "수동 만료",
  cancelled: "취소",
} as const;

type PassStatus = keyof typeof STATUS_LABELS;
type Member = { id: string; name: string; phone: string | null; birth_date: string | null; skill_division: string | null; status: string };
type PassUsage = { lesson_pass_id: string | null; lesson_date: string };
type Pass = {
  id: string;
  member_id: string;
  total_count: number;
  used_count: number;
  paid_at: string;
  recommended_use_by: string;
  status: PassStatus;
  memo: string | null;
  created_at: string;
  members: { name?: string; phone?: string | null } | Array<{ name?: string; phone?: string | null }> | null;
};

function relationMember(value: Pass["members"]) {
  if (Array.isArray(value)) return value[0] ?? {};
  return value ?? {};
}

export default async function LessonPassesPage({ searchParams }: { searchParams: Promise<{ member?: string; status?: string; q?: string; return_to?: string; error?: string; success?: string }> }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: members, error: membersError }, { data: passData, error: passesError }, { data: usageData, error: usageError }] = await Promise.all([
    supabase.from("members").select("id, name, phone, birth_date, skill_division, status").neq("status", "ended").order("name"),
    supabase.from("lesson_passes").select("id, member_id, total_count, used_count, paid_at, recommended_use_by, status, memo, created_at, members(name, phone)").order("paid_at", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("lesson_records").select("lesson_pass_id, lesson_date").eq("status", "approved").not("lesson_pass_id", "is", null).order("lesson_date", { ascending: false }).order("approved_at", { ascending: false }),
  ]);
  const memberRows = (members ?? []) as Member[];
  const passes = (passData ?? []) as Pass[];
  const latestUseByPass = new Map<string, string>();
  for (const usage of (usageData ?? []) as PassUsage[]) if (usage.lesson_pass_id && !latestUseByPass.has(usage.lesson_pass_id)) latestUseByPass.set(usage.lesson_pass_id, usage.lesson_date);
  const today = koreaBusinessDate();
  const query = (params.q ?? "").trim().toLocaleLowerCase("ko-KR");
  const isOverdueFilter = params.status === "overdue";
  const selectedStatus = Object.hasOwn(STATUS_LABELS, params.status ?? "") ? params.status as PassStatus : "";
  const filteredPasses = passes.filter((pass) => {
    const member = relationMember(pass.members);
    const matchesMember = !params.member || pass.member_id === params.member;
    const matchesStatus = isOverdueFilter
      ? pass.status === "active" && pass.recommended_use_by < today
      : !selectedStatus || pass.status === selectedStatus;
    const matchesQuery = !query || (member.name ?? "").toLocaleLowerCase("ko-KR").includes(query) || (member.phone ?? "").includes(query);
    return matchesMember && matchesStatus && matchesQuery;
  });
  const todayRegistrations = passes.filter((pass) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(pass.created_at)) === today);
  const activePasses = passes.filter((pass) => pass.status === "active");
  const totalRemainingByMember = new Map<string, number>();
  for (const pass of passes) {
    if (pass.status === "active" || pass.status === "pending") totalRemainingByMember.set(pass.member_id, (totalRemainingByMember.get(pass.member_id) ?? 0) + pass.total_count - pass.used_count);
  }
  const lowPasses = activePasses.filter((pass) => {
    const totalRemaining = totalRemainingByMember.get(pass.member_id) ?? 0;
    return totalRemaining > 0 && totalRemaining <= 2;
  });
  const overduePasses = activePasses.filter((pass) => pass.recommended_use_by < today);
  const attentionPasses = overduePasses;
  const registrationMembers: LessonPassRegistrationMember[] = memberRows.map((member) => {
    const activePass = passes.find((pass) => pass.member_id === member.id && pass.status === "active");
    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
      birthDate: member.birth_date,
      skillDivision: member.skill_division,
      activeRemaining: activePass ? activePass.total_count - activePass.used_count : null,
      pendingCount: passes.filter((pass) => pass.member_id === member.id && pass.status === "pending").length,
    };
  });
  const todayLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date(`${today}T00:00:00+09:00`));
  const pageError = params.error ?? membersError?.message ?? passesError?.message ?? usageError?.message;

  return (
    <div className="dashboard-shell passes-shell">
      <DashboardSidebar activeHref="/lesson-passes" profile={profile} />
      <DashboardRefresh />
      <div className="dashboard-workspace">
        <header className="dashboard-topbar passes-topbar">
          <div><h1>레슨권 관리</h1><p>회원별 레슨권 등록과 사용 현황을 관리합니다.</p></div>
          <div className="dashboard-topbar-meta">{profile.role === "admin" && <LessonPassRegistrationModal initialMemberId={params.member} members={registrationMembers} returnTo={params.return_to} today={today} />}<time dateTime={today}>{todayLabel}</time><span className="dashboard-user-avatar">{profile.display_name.slice(0, 1)}</span></div>
        </header>
        <main className="passes-main">
          <Notice error={pageError} success={params.success} />

          <section className="passes-stat-grid" aria-label="레슨권 현황">
            <article><span className="red">▰</span><div><small>오늘 등록</small><strong>{todayRegistrations.length}<b>건</b></strong><em>시스템 등록 기준</em></div></article>
            <article><span className="orange">●</span><div><small>잔여 2회 이하</small><strong>{lowPasses.length}<b>명</b></strong><em>소진 안내 필요</em></div></article>
            <article><span className="red">!</span><div><small>권장 소진일 경과</small><strong>{overduePasses.length}<b>명</b></strong><em>확인 후 수동 처리</em></div></article>
          </section>

          <div className="passes-content-grid coach">
            <div className="passes-left-column">
              <section className="passes-history-panel">
                <div className="passes-panel-heading"><h2>레슨권 내역</h2><form><label><span>⌕</span><input defaultValue={params.q ?? ""} enterKeyHint="search" inputMode="search" name="q" placeholder="회원명 또는 전화번호 검색" spellCheck={false} type="search" /></label>{params.member && <input name="member" type="hidden" value={params.member} />}<button type="submit">검색</button></form></div>
                <nav className="passes-filter-tabs" aria-label="레슨권 상태 필터">
                  <Link className={!selectedStatus && !isOverdueFilter ? "active" : ""} href="/lesson-passes">전체</Link>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <Link className={selectedStatus === value ? "active" : ""} href={`/lesson-passes?status=${value}`} key={value}>{label}</Link>)}
                  <Link className={isOverdueFilter ? "active" : ""} href="/lesson-passes?status=overdue">소진일 경과</Link>
                </nav>
                <div className="passes-table-wrap">
                  <table className="passes-table"><thead><tr><th>회원명</th><th>전화번호</th><th>등록일</th><th>최근 사용일</th><th>잔여 횟수</th><th>상태</th><th>레슨권 수정</th></tr></thead><tbody>
                    {filteredPasses.map((pass) => { const member = relationMember(pass.members); const memberName = member.name ?? "회원"; const remaining = pass.total_count - pass.used_count; const totalRemaining = totalRemainingByMember.get(pass.member_id) ?? 0; const needsWarning = pass.status === "active" && totalRemaining > 0 && totalRemaining <= 2; const latestUse = latestUseByPass.get(pass.id); return <tr key={pass.id}><td><Link className="passes-member-link" href={`/members/${pass.member_id}`}>{memberName}</Link></td><td>{member.phone ?? "-"}</td><td>{pass.paid_at}</td><td>{latestUse ?? <span className="passes-no-use">사용 이력 없음</span>}</td><td><strong className={needsWarning ? "passes-low" : ""}>{remaining}회</strong></td><td><span className={`passes-status ${pass.status}`}>{STATUS_LABELS[pass.status]}</span></td><td>{profile.role === "admin" ? <LessonPassEditModal lessonPass={{ id: pass.id, memberId: pass.member_id, memberName, paidAt: pass.paid_at, recommendedUseBy: pass.recommended_use_by, remainingCount: remaining, status: pass.status, statusLabel: STATUS_LABELS[pass.status], memo: pass.memo }} /> : <span>-</span>}</td></tr>; })}
                    {!filteredPasses.length && <tr><td className="passes-empty" colSpan={7}>조건에 맞는 레슨권이 없습니다.</td></tr>}
                  </tbody></table>
                </div>
              </section>

              <section className="passes-attention-panel">
                <div className="passes-panel-heading"><h2>확인 필요</h2><span>{attentionPasses.length}건</span></div>
                <div className="passes-attention-list">
                  {attentionPasses.map((pass) => { const member = relationMember(pass.members); const remaining = pass.total_count - pass.used_count; const totalRemaining = totalRemainingByMember.get(pass.member_id) ?? remaining; return <article key={pass.id}><span className="danger">!</span><div><strong>{member.name ?? "회원"}</strong><small>{member.phone ?? "-"}</small></div><b>권장 소진일 경과</b><p><span>{pass.recommended_use_by}</span><span>잔여 {totalRemaining}회</span></p>{profile.role === "admin" ? <form action={manuallyExpireLessonPass}><input name="lesson_pass_id" type="hidden" value={pass.id} /><input name="member_id" type="hidden" value={pass.member_id} /><input aria-label={`${member.name ?? "회원"} 수동 만료 사유`} name="reason" placeholder="처리 사유" required /><button type="submit">수동 만료</button></form> : <Link href={`/members/${pass.member_id}`}>상세 보기</Link>}</article>; })}
                  {!attentionPasses.length && <p className="passes-empty">확인이 필요한 레슨권이 없습니다.</p>}
                </div>
              </section>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
