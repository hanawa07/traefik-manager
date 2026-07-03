import { useWatch, type Control } from "react-hook-form";

import type { ServiceFormData } from "./serviceFormSchema";

export function useServiceFormWatchValues(control: Control<ServiceFormData>) {
  const [tlsEnabled, authMode, apiKeyValue, basicAuthEnabled, rateLimitEnabled, upstreamScheme, healthcheckEnabled] =
    useWatch({
      control,
      name: [
        "tls_enabled",
        "auth_mode",
        "api_key",
        "basic_auth_enabled",
        "rate_limit_enabled",
        "upstream_scheme",
        "healthcheck_enabled",
      ],
    });

  return {
    tlsEnabled,
    authMode,
    apiKeyValue,
    basicAuthEnabled,
    rateLimitEnabled,
    upstreamScheme,
    healthcheckEnabled,
    isAuthentikEnabled: authMode === "authentik",
    isAnyAuthEnabled: authMode !== "none",
  };
}
