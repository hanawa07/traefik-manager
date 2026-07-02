import { useEffect, useRef, useState } from "react";

import type { LoginProtectionResponse } from "@/features/auth/api/authApi";

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

export function useLoginTurnstile(loginProtection: LoginProtectionResponse) {
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [token, setToken] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (
      !loginProtection.turnstile_required ||
      !loginProtection.turnstile_site_key ||
      !turnstileReady ||
      !containerRef.current ||
      widgetIdRef.current !== null
    ) {
      return;
    }

    const turnstile = getTurnstileApi();
    if (!turnstile) {
      return;
    }

    widgetIdRef.current = turnstile.render(containerRef.current, {
      sitekey: loginProtection.turnstile_site_key,
      callback: (nextToken) => setToken(nextToken),
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
  }, [loginProtection.turnstile_required, loginProtection.turnstile_site_key, turnstileReady]);

  useEffect(() => {
    if (loginProtection.turnstile_required && loginProtection.turnstile_site_key) {
      return;
    }
    widgetIdRef.current = null;
    setToken("");
  }, [loginProtection.turnstile_required, loginProtection.turnstile_site_key]);

  const resetChallenge = () => {
    const turnstile = getTurnstileApi();
    if (turnstile && widgetIdRef.current !== null) {
      turnstile.reset(widgetIdRef.current);
      setToken("");
    }
  };

  return {
    token,
    containerRef,
    onReady: () => setTurnstileReady(true),
    resetChallenge,
  };
}

function getTurnstileApi() {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}
