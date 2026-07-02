import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { authApi, type LoginProtectionResponse } from "@/features/auth/api/authApi";
import { useAuthStore } from "@/features/auth/store/useAuthStore";

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

const DEFAULT_LOGIN_PROTECTION: LoginProtectionResponse = {
  turnstile_mode: "off",
  turnstile_enabled: false,
  turnstile_required: false,
  turnstile_site_key: null,
};

export function useLoginPageModel() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const syncSession = useAuthStore((state) => state.syncSession);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrated = useAuthStore((state) => state._hydrated);
  const initialized = useAuthStore((state) => state._initialized);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginProtection, setLoginProtection] = useState<LoginProtectionResponse>(
    DEFAULT_LOGIN_PROTECTION,
  );
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
          setLoginProtection(DEFAULT_LOGIN_PROTECTION);
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

    const turnstile = getTurnstileApi();
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      if (resetTurnstileChallenge(turnstileWidgetIdRef.current)) {
        setTurnstileToken("");
      }
      try {
        const nextProtection = await loadLoginProtection();
        setError(getLoginFailureMessage(nextProtection.turnstile_required));
      } catch {
        setError(getLoginFailureMessage(loginProtection.turnstile_required));
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    username,
    password,
    error,
    loading,
    loginProtection,
    turnstileContainerRef,
    onUsernameChange: setUsername,
    onPasswordChange: setPassword,
    onSubmit: handleSubmit,
    onTurnstileReady: () => setTurnstileReady(true),
  };
}

export type LoginPageModel = ReturnType<typeof useLoginPageModel>;

function getTurnstileApi() {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

function resetTurnstileChallenge(widgetId: string | number | null) {
  const turnstile = getTurnstileApi();
  if (turnstile && widgetId !== null) {
    turnstile.reset(widgetId);
    return true;
  }
  return false;
}

function getLoginFailureMessage(turnstileRequired: boolean) {
  return turnstileRequired
    ? "아이디/비밀번호 또는 추가 로그인 검증이 올바르지 않습니다"
    : "아이디 또는 비밀번호가 올바르지 않습니다";
}
