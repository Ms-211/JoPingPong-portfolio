import Link from "next/link";
import { notFound } from "next/navigation";

import { issueMemberQr, updateMember } from "@/app/members/actions";
import { DashboardRefresh } from "@/components/dashboard-refresh";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LessonPassRegistrationModal, type LessonPassRegistrationMember } from "@/components/lesson-pass-registration-modal";
import { MemberForm } from "@/components/member-form";
import { Notice } from "@/components/notice";
import { QrPreview } from "@/components/qr-preview";
import { requireProfile } from "@/lib/auth/session";
import { koreaBusinessDate } from "@/lib/date/business-date";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS = { active: "이용 중", ended: "종료" } as const;
const GENDER_LABELS = { male: "남성", female: "여성" } as const;
const PASS_STATUS_LABELS = { pending: "사용 예정", active: "사용 중", exhausted: "소진", expired: "수동 만료", cancelled: "취소" } as const;
const WEEKDAY_LABELS: Record<number, string> = { 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토", 7: "일" };

function weekdayLabel(weekdays: number[]) {
  return weekdays.map((day) => WEEKDAY_LABELS[day]).filter(Boolean).join(" · ") || "미지정";
}

function passStatusLabel(status: string) {
  return PASS_STATUS_LABELS[status as keyof typeof PASS_STATUS_LABELS] ?? status;
}

function recentLessonDateTime(lessonDate: string, approvedAt: string | null) {
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(`${lessonDate}T00:00:00+09:00`));
  const time = approvedAt
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(approvedAt))
    : "시간 미기록";
  return `${lessonDate}(${weekday.replace("요일", "")}) ${time}`;
}

export default async function MemberDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const messages = await searchParams;
  const supabase = await createClient();
  const [{ data: member }, { data: qr }, { data: passes }, approvedCountResult, { data: recentRecords }] = await Promise.all([
    supabase.from("members").select("*").eq("id", id).maybeSingle(),
    supabase.from("member_qr_tokens").select("id, qr_path, issued_at").eq("member_id", id).eq("is_active", true).maybeSingle(),
    supabase.from("lesson_passes").select("id, total_count, used_count, paid_at, recommended_use_by, status").eq("member_id", id).order("paid_at", { ascending: false }),
    supabase.from("lesson_records").select("id", { count: "exact", head: true }).eq("member_id", id).eq("status", "approved"),
    supabase.from("lesson_records").select("id, lesson_date, request_method, approved_at").eq("member_id", id).eq("status", "approved").order("lesson_date", { ascending: false }).order("approved_at", { ascending: false }).limit(3),
  ]);

  if (!member) notFound();

  const [{ data: photoUrl }] = await Promise.all([
    member.photo_path ? supabase.storage.from("member-private").createSignedUrl(member.photo_path, 600) : Promise.resolve({ data: null }),
  ]);
  const qrUrl = qr?.qr_path
    ? `/api/members/${encodeURIComponent(id)}/qr?issued=${encodeURIComponent(qr.issued_at)}`
    : null;
  const hasUsableQr = Boolean(qrUrl);
  const activePass = (passes ?? []).find((pass) => pass.status === "active");
  const hasPendingPass = (passes ?? []).some((pass) => pass.status === "pending");
  const remaining = activePass ? activePass.total_count - activePass.used_count : 0;
  const totalRemaining = (passes ?? [])
    .filter((pass) => pass.status === "active" || pass.status === "pending")
    .reduce((sum, pass) => sum + pass.total_count - pass.used_count, 0);
  const approvedCount = approvedCountResult.count ?? 0;
  const registrationMember: LessonPassRegistrationMember = {
    id: member.id,
    name: member.name,
    phone: member.phone,
    birthDate: member.birth_date,
    skillDivision: member.skill_division,
    activeRemaining: activePass ? remaining : null,
    pendingCount: (passes ?? []).filter((pass) => pass.status === "pending").length,
  };

  return (
    <div className="dashboard-shell member-detail-shell">
      <DashboardSidebar activeHref="/members" profile={profile} />
      <DashboardRefresh />
      <div className="dashboard-workspace">
        <header className="dashboard-topbar member-detail-topbar"><div><h1>회원 상세</h1><p>회원 관리 › {member.name}</p></div><div className="member-detail-top-actions"><Link className="member-list-back-button" href="/members" aria-label="회원 목록으로 돌아가기"><span aria-hidden="true">←</span><strong>뒤로</strong></Link><span className="dashboard-user-avatar">{profile.display_name.slice(0, 1)}</span></div></header>
        <main className="member-detail-main">
          <Notice error={messages.error} success={messages.success} />

          <section className="member-detail-hero">
            {photoUrl?.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${member.name} 회원 사진`} src={photoUrl.signedUrl} />
            ) : <span className="member-detail-avatar-placeholder">{member.name.slice(0, 1)}</span>}
            <div className="member-detail-identity"><div><h2>{member.name}</h2><b className={`members-status ${member.status}`}>{STATUS_LABELS[member.status as keyof typeof STATUS_LABELS]}</b></div><p>☎ {member.phone ?? "전화번호 없음"}</p><p>생년월일 {member.birth_date ?? "미등록"} · 성별 {GENDER_LABELS[member.gender as keyof typeof GENDER_LABELS] ?? "미등록"}{member.skill_division ? ` · ${member.skill_division}` : ""}</p><span>{weekdayLabel(member.fixed_weekdays)} 고정 레슨 · {member.joined_at} 등록</span></div>
            <div className="member-detail-hero-actions">{profile.role === "admin" && <LessonPassRegistrationModal initialMemberId={id} members={[registrationMember]} openInitially={false} returnTo={`/members/${id}`} today={koreaBusinessDate()} />}</div>
          </section>

          <section className="member-detail-stat-grid">
            <article><small>현재 잔여 횟수</small><strong className={totalRemaining > 0 && totalRemaining <= 2 ? "danger" : ""}>{activePass ? `${remaining}회` : "없음"}</strong><span>{activePass ? `${activePass.used_count}/${activePass.total_count}회 사용${hasPendingPass ? ` · 전체 잔여 ${totalRemaining}회` : ""}` : hasPendingPass ? `예비 레슨 ${totalRemaining}회` : "활성 레슨권 없음"}</span></article>
            <article><small>권장 소진일</small><strong>{activePass?.recommended_use_by ?? "-"}</strong><span>등록일 기준 2개월</span></article>
            <article><small>누적 승인 레슨</small><strong>{approvedCount}회</strong><span>승인 완료 기록 기준</span></article>
            <article><small>회원 QR</small><strong>{hasUsableQr ? "발급 완료" : "미발급"}</strong><span>{hasUsableQr && qr?.issued_at ? new Date(qr.issued_at).toLocaleDateString("ko-KR") : "QR 발급 필요"}</span></article>
          </section>

          <div className="member-detail-content-grid">
            <section className="member-detail-info-card">{profile.role === "admin" ? <MemberForm action={updateMember.bind(null, id)} member={member} /> : <><div className="member-detail-card-heading"><div><h2>회원 정보</h2><p>연락처, 생년월일, 성별, 부수와 운영 정보를 확인합니다.</p></div></div><dl className="description-list"><div><dt>전화번호</dt><dd>{member.phone ?? "-"}</dd></div><div><dt>생년월일</dt><dd>{member.birth_date ?? "-"}</dd></div><div><dt>성별</dt><dd>{GENDER_LABELS[member.gender as keyof typeof GENDER_LABELS] ?? "미등록"}</dd></div><div><dt>부수</dt><dd>{member.skill_division ?? "-"}</dd></div><div><dt>상태</dt><dd>{STATUS_LABELS[member.status as keyof typeof STATUS_LABELS]}</dd></div><div><dt>등록일</dt><dd>{member.joined_at}</dd></div><div><dt>중요 메모</dt><dd>{member.important_memo ?? "-"}</dd></div><div><dt>일반 메모</dt><dd>{member.memo ?? "-"}</dd></div></dl></>}</section>

            <aside className="member-detail-side-column">
              <section className="member-detail-qr-card" id="member-qr"><div className="member-detail-card-heading"><div><h2>회원 QR</h2><p>QR 출석 요청에 사용하는 회원 전용 코드입니다.</p></div></div>{qrUrl ? <><QrPreview name={member.name} phone={member.phone} url={qrUrl} />{profile.role === "admin" && <form action={issueMemberQr.bind(null, id)} className="member-detail-qr-issue no-print"><label><span className="member-detail-qr-issue-title">재발급 사유 <span className="required">필수</span></span><input name="reason" placeholder="분실, 훼손 등" required /></label><button type="submit">QR 재발급</button></form>}</> : profile.role === "admin" ? <form action={issueMemberQr.bind(null, id)} className="member-detail-first-qr"><span>⌗</span><p>아직 발급된 QR이 없습니다.</p><button type="submit">최초 QR 발급</button></form> : <p className="muted">아직 발급된 QR이 없습니다.</p>}</section>

              <section className="member-detail-pass-card"><div className="member-detail-card-heading"><div><h2>레슨권 내역</h2><p>최근 등록된 2건입니다.</p></div><Link href={`/lesson-passes?member=${id}`}>전체 관리 ›</Link></div><div className="member-detail-pass-list">{(passes ?? []).slice(0, 2).map((pass) => <article key={pass.id}><div><b className={`passes-status ${pass.status}`}>{passStatusLabel(pass.status)}</b><strong>{pass.total_count - pass.used_count}회 남음</strong><span>{pass.used_count}/{pass.total_count}회 사용</span></div><small><span>등록 {pass.paid_at}</span><span>소진 {pass.recommended_use_by}</span></small></article>)}{!passes?.length && <p className="member-detail-empty">등록된 레슨권이 없습니다.</p>}</div></section>

              <section className="member-detail-history-card"><div className="member-detail-card-heading"><div><h2>최근 출석 기록</h2><p>최근 승인된 레슨 3건입니다.</p></div><Link href={`/lesson-records?member=${id}`}>전체 보기 ›</Link></div><div>{(recentRecords ?? []).map((record) => <p key={record.id}><span className="member-history-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 9h18M8 15l2.5 2.5L16 12" /></svg></span><time dateTime={record.approved_at ?? record.lesson_date}>{recentLessonDateTime(record.lesson_date, record.approved_at)}</time><b>{record.request_method === "qr" ? "QR" : "직접 등록"}</b></p>)}{!recentRecords?.length && <p className="member-detail-empty">승인된 출석 기록이 없습니다.</p>}</div></section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
