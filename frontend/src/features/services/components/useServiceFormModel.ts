"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useMiddlewareTemplates } from "@/features/middlewares/hooks/useMiddlewares";
import type { ServiceCreate } from "../api/serviceApi";
import { useAuthentikGroups } from "../hooks/useServices";
import { useServiceContainerImportModel } from "./useServiceContainerImportModel";
import { useServiceFormActions } from "./useServiceFormActions";
import { useServiceFormSyncEffects } from "./useServiceFormSyncEffects";
import { serviceFormSchema, type ServiceFormData, type ServiceFormDefaultValues } from "./serviceFormSchema";
import { buildServiceSubmitPayload, createServiceFormDefaultValues } from "./serviceFormPayload";
import { useServiceFormFieldArrays } from "./useServiceFormFieldArrays";
import { useServiceFormWatchValues } from "./useServiceFormWatchValues";

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

  const {
    customHeaderFields,
    appendCustomHeader,
    removeCustomHeader,
    basicAuthFields,
    appendBasicAuthField,
    removeBasicAuthField,
  } = useServiceFormFieldArrays(control);
  const watchValues = useServiceFormWatchValues(control);

  const { data: authentikGroups = [] } = useAuthentikGroups(watchValues.isAuthentikEnabled);
  const { data: middlewareTemplates = [], isLoading: isMiddlewareLoading } = useMiddlewareTemplates();
  const { onOpenContainerImportModal, containerImportModal } = useServiceContainerImportModel({ setValue });
  const serviceFormActions = useServiceFormActions({
    appendBasicAuthField,
    appendCustomHeader,
    removeBasicAuthField,
    removeCustomHeader,
    setValue,
  });

  useServiceFormSyncEffects({
    apiKeyValue: watchValues.apiKeyValue,
    authMode: watchValues.authMode,
    defaultApiKey: defaultValues?.api_key,
    setValue,
    tlsEnabled: watchValues.tlsEnabled,
    upstreamScheme: watchValues.upstreamScheme,
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
      routingMode: watchValues.routingMode,
      tlsEnabled: watchValues.tlsEnabled,
      authMode: watchValues.authMode,
      apiKeyValue: watchValues.apiKeyValue,
      basicAuthEnabled: watchValues.basicAuthEnabled,
      rateLimitEnabled: watchValues.rateLimitEnabled,
      upstreamScheme: watchValues.upstreamScheme,
      healthcheckEnabled: watchValues.healthcheckEnabled,
      isAnyAuthEnabled: watchValues.isAnyAuthEnabled,
      authentikGroups,
      middlewareTemplates,
      isMiddlewareLoading,
      customHeaderFields,
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
