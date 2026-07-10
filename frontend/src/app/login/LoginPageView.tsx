import LoginBrandHeader from "@/features/auth/components/LoginBrandHeader";
import LoginFormCard from "@/features/auth/components/LoginFormCard";

import type { LoginPageModel } from "./useLoginPageModel";

export default function LoginPageView({
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
}: LoginPageModel) {
  return (
    <div
      data-visual-background
      className={
        "flex min-h-screen items-center justify-center bg-gradient-to-br " +
        "from-slate-950 via-[#0F172A] to-slate-900 p-4"
      }
    >
      <div className="w-full max-w-sm">
        <LoginBrandHeader />
        <LoginFormCard
          username={username}
          password={password}
          error={error}
          loading={loading}
          loginProtection={loginProtection}
          turnstileContainerRef={turnstileContainerRef}
          onUsernameChange={onUsernameChange}
          onPasswordChange={onPasswordChange}
          onSubmit={onSubmit}
          onTurnstileReady={onTurnstileReady}
        />
        <p className="mt-8 text-center text-xs uppercase tracking-widest text-slate-500 opacity-50">
          © 2026 Traefik Manager Professional
        </p>
      </div>
    </div>
  );
}
