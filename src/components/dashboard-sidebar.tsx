import Image from "next/image";
import Link from "next/link";

import { logout } from "@/app/auth/actions";
import type { Profile } from "@/lib/auth/authorization";

type IconName = "dashboard" | "approvals" | "checkin" | "members" | "passes" | "records" | "logout";

function SidebarIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
    approvals: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    checkin: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 9h16M8 14l2.5 2.5L16 12" /></>,
    members: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-2.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V20M16 5.5a3 3 0 0 1 0 5.5M17 13a4 4 0 0 1 3.5 4v3" /></>,
    passes: <><path d="M4 7a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z" /><path d="M12 7v10" /></>,
    records: <><path d="M7 3h10v4H7z" /><path d="M5 5H4v16h16V5h-1M8 12h8M8 16h6" /></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드", icon: "dashboard" as const },
  { href: "/approvals", label: "승인 대기", icon: "approvals" as const },
  { href: "/checkin", label: "QR 인식 화면", icon: "checkin" as const },
  { href: "/members", label: "회원 관리", icon: "members" as const },
  { href: "/lesson-passes", label: "레슨권 관리", icon: "passes" as const },
  { href: "/lesson-records", label: "레슨 기록", icon: "records" as const },
];

function SidebarNavigation({ activeHref, className }: { activeHref: string; className?: string }) {
  return (
    <nav aria-label="대시보드 메뉴" className={className}>
      {NAV_ITEMS.map((item) => (
        <Link className={item.href === activeHref ? "active" : ""} href={item.href} key={item.href}>
          <SidebarIcon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function DashboardSidebar({
  profile,
  activeHref = "/dashboard",
}: {
  profile: Profile;
  activeHref?: string;
}) {
  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar-header">
        <Link className="dashboard-brand" href="/dashboard">
          <Image
            alt=""
            aria-hidden="true"
            className="dashboard-brand-logo"
            height={48}
            priority
            src="/dashboard-brand-logo.png"
            width={48}
          />
          <span>조탁구 아카데미</span>
        </Link>

        <details className="dashboard-mobile-menu">
          <summary aria-label="메뉴 열기">
            <span className="dashboard-hamburger" aria-hidden="true"><i /><i /><i /></span>
            <span>메뉴</span>
          </summary>
          <div className="dashboard-mobile-menu-panel">
            <SidebarNavigation activeHref={activeHref} className="dashboard-mobile-nav" />
            <div className="dashboard-mobile-account">
              <div>
                <span>{profile.display_name.slice(0, 1)}</span>
                <p><strong>{profile.display_name}</strong><small>{profile.role === "admin" ? "관리자" : "코치"}</small></p>
              </div>
              <form action={logout}>
                <button type="submit"><SidebarIcon name="logout" />로그아웃</button>
              </form>
            </div>
          </div>
        </details>
      </div>

      <SidebarNavigation activeHref={activeHref} className="dashboard-desktop-nav" />
      <div className="dashboard-account">
        <div className="dashboard-account-name">
          <span>{profile.display_name.slice(0, 1)}</span>
          <div><strong>{profile.display_name}</strong><small>{profile.role === "admin" ? "관리자" : "코치"}</small></div>
        </div>
        <form action={logout}>
          <button type="submit"><SidebarIcon name="logout" />로그아웃</button>
        </form>
      </div>
    </aside>
  );
}
