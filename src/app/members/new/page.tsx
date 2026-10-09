import { DashboardRefresh } from "@/components/dashboard-refresh";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { NewMemberForm } from "@/components/new-member-form";
import { Notice } from "@/components/notice";
import { requireProfile } from "@/lib/auth/session";
import { koreaBusinessDate } from "@/lib/date/business-date";

export default async function NewMemberPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await requireProfile(["admin"]);
  const params = await searchParams;
  const today = koreaBusinessDate();

  return (
    <div className="dashboard-shell member-create-shell">
      <DashboardSidebar activeHref="/members" profile={profile} />
      <DashboardRefresh />
      <div className="dashboard-workspace">
        <header className="dashboard-topbar member-create-topbar"><div><h1>신규 회원 등록</h1><p>회원 관리 › 신규 회원 등록</p></div><span className="dashboard-user-avatar">{profile.display_name.slice(0, 1)}</span></header>
        <main className="member-create-main">
          <Notice error={params.error} />
          <nav className="member-create-steps" aria-label="신규 회원 등록 흐름"><span className="active"><b>1</b>회원 정보 입력</span><i /><span><b>2</b>회원 상세 확인</span><i /><span><b>3</b>레슨권 · QR 필요 시 등록</span></nav>
          <NewMemberForm defaultJoinedAt={today} />
        </main>
      </div>
    </div>
  );
}
