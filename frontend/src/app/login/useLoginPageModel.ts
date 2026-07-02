import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { authApi, type LoginProtectionResponse } from "@/features/auth/api/authApi";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useLoginTurnstile } from "./useLoginTurnstile";

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
  const {
    token: turnstileToken,
    containerRef: turnstileContainerRef,
    onReady: handleTurnstileReady,
    resetChallenge,
  } = useLoginTurnstile(loginProtection);

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
      resetChallenge();
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
    onTurnstileReady: handleTurnstileReady,
  };
}

export type LoginPageModel = ReturnType<typeof useLoginPageModel>;

function getLoginFailureMessage(turnstileRequired: boolean) {
  return turnstileRequired
    ? "아이디/비밀번호 또는 추가 로그인 검증이 올바르지 않습니다"
    : "아이디 또는 비밀번호가 올바르지 않습니다";
}
