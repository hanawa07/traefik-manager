"use client";

import { useEffect } from "react";
import type { UseFormSetValue } from "react-hook-form";

import type { ServiceFormData } from "./serviceFormSchema";
import { generateSecureToken } from "./serviceFormUtils";

interface UseServiceFormSyncEffectsParams {
  apiKeyValue: string | null | undefined;
  authMode: ServiceFormData["auth_mode"];
  defaultApiKey?: string | null;
  setValue: UseFormSetValue<ServiceFormData>;
  tlsEnabled: boolean;
  upstreamScheme: ServiceFormData["upstream_scheme"];
}

export function useServiceFormSyncEffects({
  apiKeyValue,
  authMode,
  defaultApiKey,
  setValue,
  tlsEnabled,
  upstreamScheme,
}: UseServiceFormSyncEffectsParams) {
  useEffect(() => {
    if (defaultApiKey) {
      setValue("api_key", defaultApiKey);
    }
  }, [defaultApiKey, setValue]);

  useEffect(() => {
    if (authMode === "token" && !apiKeyValue) {
      setValue("api_key", generateSecureToken());
    }
  }, [authMode, apiKeyValue, setValue]);

  useEffect(() => {
    if (!tlsEnabled) {
      setValue("https_redirect_enabled", false);
    }
  }, [tlsEnabled, setValue]);

  useEffect(() => {
    if (authMode !== "authentik") {
      setValue("authentik_group_id", "");
    }
  }, [authMode, setValue]);

  useEffect(() => {
    if (authMode !== "none") {
      setValue("basic_auth_enabled", false);
      setValue("basic_auth_credentials", [{ username: "", password: "" }]);
    }
  }, [authMode, setValue]);

  useEffect(() => {
    if (upstreamScheme === "http") {
      setValue("skip_tls_verify", false);
    }
  }, [upstreamScheme, setValue]);
}
