"use client";

import { useState } from "react";
import type { UseFieldArrayAppend, UseFieldArrayRemove, UseFormSetValue } from "react-hook-form";

import type { ServiceFormData } from "./serviceFormSchema";
import { generateSecureToken } from "./serviceFormUtils";

interface UseServiceFormActionsParams {
  appendBasicAuthField: UseFieldArrayAppend<ServiceFormData, "basic_auth_credentials">;
  appendCustomHeader: UseFieldArrayAppend<ServiceFormData, "custom_headers">;
  removeBasicAuthField: UseFieldArrayRemove;
  removeCustomHeader: UseFieldArrayRemove;
  setValue: UseFormSetValue<ServiceFormData>;
}

export function useServiceFormActions({
  appendBasicAuthField,
  appendCustomHeader,
  removeBasicAuthField,
  removeCustomHeader,
  setValue,
}: UseServiceFormActionsParams) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return {
    copied,
    onAddBasicAuthUser: () => appendBasicAuthField({ username: "", password: "" }),
    onAddCustomHeader: () => appendCustomHeader({ key: "", value: "" }),
    onCopyApiKey: copyToClipboard,
    onRegenerateApiKey: () => setValue("api_key", generateSecureToken()),
    onRemoveBasicAuthUser: removeBasicAuthField,
    onRemoveCustomHeader: removeCustomHeader,
  };
}
