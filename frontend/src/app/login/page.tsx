"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { authApi } from "@/features/auth/api/authApi";
import { Lock, User } from "lucide-react";

type LoginProtectionState = {
  turnstile_enabled: boolean;
  turnstile_site_key: string | null;
};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string | number;
  reset: (widgetId?: string | number) => void;
};

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const syncSession = useAuthStore((s) => s.syncSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s._hydrated);
  const initialized = useAuthStore((s) => s._initialized);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginProtection, setLoginProtection] = useState<LoginProtectionState>({
    turnstile_enabled: false,
    turnstile_site_key: null,
  });
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (hydrated && !initialized) {
      void syncSession();
    }
  }, [hydrated, initialized, syncSession]);

  useEffect(() => {
    if (hydrated && initialized && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [hydrated, initialized, isAuthenticated, router]);

  useEffect(() => {
    let cancelled = false;

    const loadLoginProtection = async () => {
      try {
        const response = await authApi.getLoginProtection();
        if (!cancelled) {
          setLoginProtection(response);
        }
      } catch {
        if (!cancelled) {
          setLoginProtection({
            turnstile_enabled: false,
            turnstile_site_key: null,
          });
        }
      }
    };

    void loadLoginProtection();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !loginProtection.turnstile_enabled ||
      !loginProtection.turnstile_site_key ||
      !turnstileReady ||
      !turnstileContainerRef.current ||
      turnstileWidgetIdRef.current !== null
    ) {
      return;
    }

    const turnstile = (window as Window & { turnstile?: TurnstileApi }).turnstile;
    if (!turnstile) {
      return;
    }

    turnstileWidgetIdRef.current = turnstile.render(turnstileContainerRef.current, {
      sitekey: loginProtection.turnstile_site_key,
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setTurnstileToken(""),
    });
  }, [loginProtection.turnstile_enabled, loginProtection.turnstile_site_key, turnstileReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (loginProtection.turnstile_enabled && !turnstileToken) {
      setError("추가 로그인 검증을 완료해주세요");
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.login(username, password, turnstileToken);
      login(result.username, result.role);
      router.replace("/dashboard");
    } catch {
      setError(loginProtection.turnstile_enabled ? "아이디/비밀번호 또는 추가 로그인 검증이 올바르지 않습니다" : "아이디 또는 비밀번호가 올바르지 않습니다");
      const turnstile = (window as Window & { turnstile?: TurnstileApi }).turnstile;
      if (turnstile && turnstileWidgetIdRef.current !== null) {
        turnstile.reset(turnstileWidgetIdRef.current);
        setTurnstileToken("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0F172A] to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 브랜드 로고: 아이콘 박스를 제거하고 이미지를 더 크게 강조 */}
        <div className="text-center mb-10">
          <div className="relative inline-block group">
            {/* 배경 광채 효과 강화 */}
            <div className="absolute -inset-10 bg-brand-primary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
            
            {/* 아이콘: 박스 없이 단독 노출 (w-32) */}
            <div className="relative transition-all duration-700 hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/icon.png" 
                alt="" 
                className="w-32 h-32 object-contain drop-shadow-[0_20px_40px_rgba(59,130,246,0.2)] dark:drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mt-8 tracking-tight">Traefik <span className="text-brand-primary">Manager</span></h1>
          <p className="text-slate-400 text-sm mt-2 font-medium tracking-wide">프리미엄 인프라 통합 관리 시스템</p>
        </div>

        {/* 로그인 폼 */}
        <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
          {loginProtection.turnstile_enabled ? (
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
              strategy="afterInteractive"
              onLoad={() => setTurnstileReady(true)}
            />
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="label text-slate-700">아이디</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  className="input pl-11 bg-slate-50/50 border-slate-100"
                  placeholder="사용자 아이디"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50/80 px-4 py-3 rounded-xl border border-red-100 font-medium">{error}</p>
            )}

            {loginProtection.turnstile_enabled ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="mb-3 text-xs font-medium tracking-wide text-slate-500">
                  추가 로그인 검증
                </p>
                <div ref={turnstileContainerRef} />
              </div>
            ) : null}

            <button type="submit" className="btn-primary w-full py-4 text-base tracking-wide" disabled={loading}>
              {loading ? "인증 중..." : "로그인"}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-500 text-xs mt-8 tracking-widest uppercase opacity-50">© 2026 Traefik Manager Professional</p>
      </div>
    </div>
  );
}
