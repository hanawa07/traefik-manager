import type { RefObject } from "react";

import type { LoginProtectionResponse } from "@/features/auth/api/authApi";

interface LoginTurnstilePanelProps {
  loginProtection: LoginProtectionResponse;
  turnstileContainerRef: RefObject<HTMLDivElement | null>;
}

export function LoginTurnstilePanel({
  loginProtection,
  turnstileContainerRef,
}: LoginTurnstilePanelProps) {
  if (loginProtection.turnstile_required) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950">
        <p className="mb-3 text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">추가 로그인 검증</p>
        <div ref={turnstileContainerRef} />
      </div>
    );
  }

  if (loginProtection.turnstile_mode === "risk_based" && loginProtection.turnstile_enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950">
        <p className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">위험 기반 로그인 검증 대기</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          최근 실패가 감지되면 Cloudflare Turnstile 검증이 자동으로 표시됩니다.
        </p>
      </div>
    );
  }

  return null;
}
