import type { FormEvent, RefObject } from "react";
import Script from "next/script";
import { Lock, User } from "lucide-react";

import type { LoginProtectionResponse } from "@/features/auth/api/authApi";

interface LoginFormCardProps {
  username: string;
  password: string;
  error: string;
  loading: boolean;
  loginProtection: LoginProtectionResponse;
  turnstileContainerRef: RefObject<HTMLDivElement | null>;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTurnstileReady: () => void;
}

export default function LoginFormCard({
  username,
  password,
  error,
  loading,
  loginProtection,
  turnstileContainerRef,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onTurnstileReady,
}: LoginFormCardProps) {
  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
      {loginProtection.turnstile_enabled && loginProtection.turnstile_site_key ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={onTurnstileReady}
        />
      ) : null}
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label className="label text-slate-700">아이디</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              className="input pl-11 bg-slate-50/50 border-slate-100"
              placeholder="사용자 아이디"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              required
              autoComplete="username"
            />
          </div>
        </div>
        <div>
          <label className="label text-slate-700">비밀번호</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="password"
              className="input pl-11 bg-slate-50/50 border-slate-100"
              placeholder="비밀번호"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50/80 px-4 py-3 rounded-xl border border-red-100 font-medium">
            {error}
          </p>
        )}

        {loginProtection.turnstile_required ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="mb-3 text-xs font-medium tracking-wide text-slate-500">추가 로그인 검증</p>
            <div ref={turnstileContainerRef} />
          </div>
        ) : loginProtection.turnstile_mode === "risk_based" && loginProtection.turnstile_enabled ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-medium tracking-wide text-slate-500">위험 기반 로그인 검증 대기</p>
            <p className="mt-2 text-xs text-slate-500">
              최근 실패가 감지되면 Cloudflare Turnstile 검증이 자동으로 표시됩니다.
            </p>
          </div>
        ) : null}

        <button type="submit" className="btn-primary w-full py-4 text-base tracking-wide" disabled={loading}>
          {loading ? "인증 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
