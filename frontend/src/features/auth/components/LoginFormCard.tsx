import type { FormEvent, RefObject } from "react";
import Script from "next/script";

import type { LoginProtectionResponse } from "@/features/auth/api/authApi";
import { LoginCredentialsFields } from "./LoginCredentialsFields";
import { LoginTurnstilePanel } from "./LoginTurnstilePanel";

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
        <LoginCredentialsFields
          username={username}
          password={password}
          onUsernameChange={onUsernameChange}
          onPasswordChange={onPasswordChange}
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50/80 px-4 py-3 rounded-xl border border-red-100 font-medium">
            {error}
          </p>
        )}

        <LoginTurnstilePanel
          loginProtection={loginProtection}
          turnstileContainerRef={turnstileContainerRef}
        />

        <button type="submit" className="btn-primary w-full py-4 text-base tracking-wide" disabled={loading}>
          {loading ? "인증 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
