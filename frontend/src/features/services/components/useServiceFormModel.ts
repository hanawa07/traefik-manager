"use client";

import { useMemo } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useMiddlewareTemplates } from "@/features/middlewares/hooks/useMiddlewares";
import type { ServiceCreate } from "../api/serviceApi";
import { useAuthentikGroups } from "../hooks/useServices";
import { useServiceContainerImportModel } from "./useServiceContainerImportModel";
import { useServiceFormActions } from "./useServiceFormActions";
import { useServiceFormSyncEffects } from "./useServiceFormSyncEffects";
import { serviceFormSchema, type ServiceFormData, type ServiceFormDefaultValues } from "./serviceFormSchema";
import { buildServiceSubmitPayload, createServiceFormDefaultValues } from "./serviceFormPayload";

interface UseServiceFormModelParams {
  defaultValues?: ServiceFormDefaultValues;
  onSubmit: (data: ServiceCreate) => void;
}

export function useServiceFormModel({ defaultValues, onSubmit }: UseServiceFormModelParams) {
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
  const serviceFormActions = useServiceFormActions({
    appendBasicAuthField,
    appendCustomHeader: append,
    removeBasicAuthField,
    removeCustomHeader: remove,
    setValue,
  });

  useServiceFormSyncEffects({
    apiKeyValue,
    authMode,
    defaultApiKey: defaultValues?.api_key,
    setValue,
    tlsEnabled,
    upstreamScheme,
  });

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
      copied: serviceFormActions.copied,
      onOpenContainerImportModal,
      onRegenerateApiKey: serviceFormActions.onRegenerateApiKey,
      onCopyApiKey: serviceFormActions.onCopyApiKey,
      onAddBasicAuthUser: serviceFormActions.onAddBasicAuthUser,
      onRemoveBasicAuthUser: serviceFormActions.onRemoveBasicAuthUser,
      onAddCustomHeader: serviceFormActions.onAddCustomHeader,
      onRemoveCustomHeader: serviceFormActions.onRemoveCustomHeader,
    },
    containerImportModal,
  };
}

export type ServiceFormModel = ReturnType<typeof useServiceFormModel>;
