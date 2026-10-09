"use client";

import { useState } from "react";

export function LoginForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="login-form login-form-redesign">
      <label>
        이메일
        <span className="login-input-wrap">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
          </svg>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="이메일을 입력하세요"
            required
          />
        </span>
      </label>
      <label>
        비밀번호
        <span className="login-input-wrap">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3M12 14v2" />
          </svg>
          <input
            className={showPassword ? "password-visible" : undefined}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="비밀번호를 입력하세요"
            required
          />
          <button
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            aria-pressed={showPassword}
            className="password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
              <circle cx="12" cy="12" r="2.5" />
              {!showPassword && <path className="password-toggle-slash" d="M4 4l16 16" />}
            </svg>
          </button>
        </span>
      </label>
      <button className="login-submit" type="submit">
        로그인
      </button>
    </form>
  );
}
