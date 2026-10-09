import Image from "next/image";

import { LoginForm } from "@/components/login-form";

import { login } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호를 확인해 주세요.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;

  return (
    <main className="login-page">
      <section className="login-visual" aria-label="조탁구 아카데미">
        <Image
          className="login-image-desktop"
          src="/login-hero-desktop.png"
          alt="조탁구 아카데미 레슨 출석 관리 시스템"
          fill
          priority
          sizes="46vw"
        />
        <Image
          className="login-image-mobile"
          src="/login-hero-mobile-centered.png"
          alt=""
          fill
          sizes="100vw"
        />
      </section>

      <section className="login-content">
        <div className="login-card">
          <p className="login-kicker">WELCOME BACK</p>
          <h1>반갑습니다</h1>
          <p className="login-description">계정 정보를 입력해 로그인해 주세요.</p>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          <LoginForm action={login} />
        </div>

        <footer className="login-footer">
          <p><span aria-hidden="true" />시스템 정상 운영 중</p>
          <small>조탁구 아카데미 출석관리 v1.0</small>
        </footer>
      </section>
    </main>
  );
}
