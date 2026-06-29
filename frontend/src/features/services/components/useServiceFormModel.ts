"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useMiddlewareTemplates } from "@/features/middlewares/hooks/useMiddlewares";
import type { ServiceCreate } from "../api/serviceApi";
import { useAuthentikGroups } from "../hooks/useServices";
import { useServiceContainerImportModel } from "./useServiceContainerImportModel";
import { serviceFormSchema, type ServiceFormData, type ServiceFormDefaultValues } from "./serviceFormSchema";
import { buildServiceSubmitPayload, createServiceFormDefaultValues } from "./serviceFormPayload";
import { generateSecureToken } from "./serviceFormUtils";

interface UseServiceFormModelParams {
  defaultValues?: ServiceFormDefaultValues;
  onSubmit: (data: ServiceCreate) => void;
}

export function useServiceFormModel({ defaultValues, onSubmit }: UseServiceFormModelParams) {
  const [copied, setCopied] = useState(false);
  const serviceFormDefaultValues = useMemo(() => createServiceFormDefaultValues(defaultValues), [defaultValues]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: serviceFormDefaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "custom_headers",
  });
  const {
    fields: basicAuthFields,
    append: appendBasicAuthField,
    remove: removeBasicAuthField,
  } = useFieldArray({
    control,
    name: "basic_auth_credentials",
  });

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

  const isAuthentikEnabled = authMode === "authentik";
  const isAnyAuthEnabled = authMode !== "none";

  const { data: authentikGroups = [] } = useAuthentikGroups(isAuthentikEnabled);
  const { data: middlewareTemplates = [], isLoading: isMiddlewareLoading } = useMiddlewareTemplates();
  const { onOpenContainerImportModal, containerImportModal } = useServiceContainerImportModel({ setValue });

  useEffect(() => {
    if (defaultValues?.api_key) {
      setValue("api_key", defaultValues.api_key);
    }
  }, [defaultValues?.api_key, setValue]);

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const submitForm = (data: ServiceFormData) => {
    onSubmit(buildServiceSubmitPayload(data));
  };

  return {
    formFields: {
      register,
      setValue,
      errors,
      onSubmit: handleSubmit(submitForm),
      tlsEnabled,
      authMode,
      apiKeyValue,
      basicAuthEnabled,
      rateLimitEnabled,
      upstreamScheme,
      healthcheckEnabled,
      isAnyAuthEnabled,
      authentikGroups,
      middlewareTemplates,
      isMiddlewareLoading,
      customHeaderFields: fields,
      basicAuthFields,
      copied,
      onOpenContainerImportModal,
      onRegenerateApiKey: () => setValue("api_key", generateSecureToken()),
      onCopyApiKey: copyToClipboard,
      onAddBasicAuthUser: () => appendBasicAuthField({ username: "", password: "" }),
      onRemoveBasicAuthUser: removeBasicAuthField,
      onAddCustomHeader: () => append({ key: "", value: "" }),
      onRemoveCustomHeader: remove,
    },
    containerImportModal,
  };
}

export type ServiceFormModel = ReturnType<typeof useServiceFormModel>;
