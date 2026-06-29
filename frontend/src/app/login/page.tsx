"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { authApi, type LoginProtectionResponse } from "@/features/auth/api/authApi";
import LoginBrandHeader from "@/features/auth/components/LoginBrandHeader";
import LoginFormCard from "@/features/auth/components/LoginFormCard";

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
  const [loginProtection, setLoginProtection] = useState<LoginProtectionResponse>({
    turnstile_mode: "off",
    turnstile_enabled: false,
    turnstile_required: false,
    turnstile_site_key: null,
  });
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | number | null>(null);

  const loadLoginProtection = async (): Promise<LoginProtectionResponse> => {
    const response = await authApi.getLoginProtection();
    setLoginProtection(response);
    return response;
  };

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

    const initializeLoginProtection = async () => {
      try {
        const response = await authApi.getLoginProtection();
        if (!cancelled) {
          setLoginProtection(response);
        }
      } catch {
        if (!cancelled) {
          setLoginProtection({
            turnstile_mode: "off",
            turnstile_enabled: false,
            turnstile_required: false,
            turnstile_site_key: null,
          });
        }
      }
    };

    void initializeLoginProtection();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !loginProtection.turnstile_required ||
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
  }, [loginProtection.turnstile_required, loginProtection.turnstile_site_key, turnstileReady]);

  useEffect(() => {
    if (loginProtection.turnstile_required && loginProtection.turnstile_site_key) {
      return;
    }
    turnstileWidgetIdRef.current = null;
    setTurnstileToken("");
  }, [loginProtection.turnstile_required, loginProtection.turnstile_site_key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (loginProtection.turnstile_required && !turnstileToken) {
      setError("추가 로그인 검증을 완료해주세요");
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.login(username, password, turnstileToken);
      login(result.username, result.role);
      router.replace("/dashboard");
    } catch {
      const turnstile = (window as Window & { turnstile?: TurnstileApi }).turnstile;
      if (turnstile && turnstileWidgetIdRef.current !== null) {
        turnstile.reset(turnstileWidgetIdRef.current);
        setTurnstileToken("");
      }
      try {
        const nextProtection = await loadLoginProtection();
        setError(
          nextProtection.turnstile_required
            ? "아이디/비밀번호 또는 추가 로그인 검증이 올바르지 않습니다"
            : "아이디 또는 비밀번호가 올바르지 않습니다",
        );
      } catch {
        setError(
          loginProtection.turnstile_required
            ? "아이디/비밀번호 또는 추가 로그인 검증이 올바르지 않습니다"
            : "아이디 또는 비밀번호가 올바르지 않습니다",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0F172A] to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <LoginBrandHeader />
        <LoginFormCard
          username={username}
          password={password}
          error={error}
          loading={loading}
          loginProtection={loginProtection}
          turnstileContainerRef={turnstileContainerRef}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onSubmit={handleSubmit}
          onTurnstileReady={() => setTurnstileReady(true)}
        />
        <p className="text-center text-slate-500 text-xs mt-8 tracking-widest uppercase opacity-50">© 2026 Traefik Manager Professional</p>
      </div>
    </div>
  );
}
