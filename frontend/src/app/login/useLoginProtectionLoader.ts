import { useEffect, useState } from "react";

import { authApi, type LoginProtectionResponse } from "@/features/auth/api/authApi";

const DEFAULT_LOGIN_PROTECTION: LoginProtectionResponse = {
  turnstile_mode: "off",
  turnstile_enabled: false,
  turnstile_required: false,
  turnstile_site_key: null,
};

export function useLoginProtectionLoader() {
  const [loginProtection, setLoginProtection] = useState<LoginProtectionResponse>(
    DEFAULT_LOGIN_PROTECTION,
  );

  const loadLoginProtection = async (): Promise<LoginProtectionResponse> => {
    const response = await authApi.getLoginProtection();
    setLoginProtection(response);
    return response;
  };

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

  return {
    loginProtection,
    loadLoginProtection,
  };
}
