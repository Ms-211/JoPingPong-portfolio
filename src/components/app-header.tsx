import Link from "next/link";

import { logout } from "@/app/auth/actions";
import type { Profile } from "@/lib/auth/authorization";

const ROLE_LABELS = {
  admin: "관리자",
  coach: "코치",
} as const;

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="app-header">
      <Link className="brand" href="/dashboard">
        탁구장 레슨 관리
      </Link>
      <nav aria-label="주요 메뉴">
        <Link href="/dashboard">대시보드</Link>
        <Link href="/members">회원</Link>
        <Link href="/lesson-passes">레슨권</Link>
        <Link href="/lesson-records">기록</Link>
      </nav>
      <div className="account-area">
        <span>
          {profile.display_name} · {ROLE_LABELS[profile.role]}
        </span>
        <form action={logout}>
          <button className="text-button" type="submit">
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
