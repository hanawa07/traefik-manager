"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { DockerContainer } from "@/features/docker/api/dockerApi";
import { useDockerContainers } from "@/features/docker/hooks/useDockerContainers";
import { useMiddlewareTemplates } from "@/features/middlewares/hooks/useMiddlewares";
import type { ServiceCreate } from "../api/serviceApi";
import { useAuthentikGroups } from "../hooks/useServices";
import type { ContainerImportMode, TraefikImportCandidate } from "./containerImportTypes";
import { serviceFormSchema, type ServiceFormData, type ServiceFormDefaultValues } from "./serviceFormSchema";
import { buildServiceSubmitPayload, createServiceFormDefaultValues } from "./serviceFormPayload";
import { formatDockerPortLabel, generateSecureToken, getSuggestedUpstreamPort } from "./serviceFormUtils";

interface UseServiceFormModelParams {
  defaultValues?: ServiceFormDefaultValues;
  onSubmit: (data: ServiceCreate) => void;
}

export function useServiceFormModel({ defaultValues, onSubmit }: UseServiceFormModelParams) {
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [containerImportMode, setContainerImportMode] = useState<ContainerImportMode>("basic");
  const [containerSearchQuery, setContainerSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const deferredContainerSearchQuery = useDeferredValue(containerSearchQuery);
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
  const {
    data: dockerContainers,
    isLoading: isDockerLoading,
    isFetching: isDockerFetching,
    isError: isDockerError,
    error: dockerContainersError,
  } = useDockerContainers(isContainerModalOpen);

  const availableContainers = useMemo(() => dockerContainers?.containers || [], [dockerContainers]);
  const traefikImportCandidates = useMemo(() => {
    return availableContainers.flatMap((container) =>
      container.traefik_candidates.map((candidate) => ({
        containerName: container.name,
        image: container.image,
        networks: container.networks,
        ...candidate,
      })),
    );
  }, [availableContainers]);
  const normalizedContainerSearchQuery = deferredContainerSearchQuery.trim().toLowerCase();
  const filteredContainers = useMemo(() => {
    if (!normalizedContainerSearchQuery) {
      return availableContainers;
    }

    return availableContainers.filter((container) => {
      const haystack = [
        container.name,
        container.image || "",
        container.state || "",
        container.status || "",
        ...container.networks,
        ...container.ports.map((port) => formatDockerPortLabel(port)),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedContainerSearchQuery);
    });
  }, [availableContainers, normalizedContainerSearchQuery]);
  const filteredTraefikImportCandidates = useMemo(() => {
    if (!normalizedContainerSearchQuery) {
      return traefikImportCandidates;
    }

    return traefikImportCandidates.filter((candidate) => {
      const haystack = [
        candidate.domain,
        candidate.containerName,
        candidate.image || "",
        candidate.router_name,
        String(candidate.upstream_port),
        ...candidate.networks,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedContainerSearchQuery);
    });
  }, [normalizedContainerSearchQuery, traefikImportCandidates]);

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

  const openContainerImportModal = () => {
    setContainerImportMode("basic");
    setContainerSearchQuery("");
    setIsContainerModalOpen(true);
  };

  const applyBasicContainerImport = (container: DockerContainer) => {
    setValue("name", container.name);
    setValue("upstream_host", container.name);
    setValue("upstream_port", getSuggestedUpstreamPort(container));
    setIsContainerModalOpen(false);
  };

  const applyTraefikContainerImport = (candidate: TraefikImportCandidate) => {
    setValue("name", candidate.containerName);
    setValue("domain", candidate.domain);
    setValue("upstream_host", candidate.upstream_host);
    setValue("upstream_port", candidate.upstream_port);
    setValue("tls_enabled", candidate.tls_enabled);
    setIsContainerModalOpen(false);
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
      onOpenContainerImportModal: openContainerImportModal,
      onRegenerateApiKey: () => setValue("api_key", generateSecureToken()),
      onCopyApiKey: copyToClipboard,
      onAddBasicAuthUser: () => appendBasicAuthField({ username: "", password: "" }),
      onRemoveBasicAuthUser: removeBasicAuthField,
      onAddCustomHeader: () => append({ key: "", value: "" }),
      onRemoveCustomHeader: remove,
    },
    containerImportModal: {
      isOpen: isContainerModalOpen,
      onClose: () => setIsContainerModalOpen(false),
      mode: containerImportMode,
      onModeChange: setContainerImportMode,
      searchQuery: containerSearchQuery,
      onSearchQueryChange: setContainerSearchQuery,
      dockerContainers,
      dockerContainersError,
      isDockerLoading,
      isDockerFetching,
      isDockerError,
      availableContainers,
      filteredContainers,
      normalizedSearchQuery: normalizedContainerSearchQuery,
      traefikImportCandidates,
      filteredTraefikImportCandidates,
      onBasicImport: applyBasicContainerImport,
      onTraefikImport: applyTraefikContainerImport,
    },
  };
}

export type ServiceFormModel = ReturnType<typeof useServiceFormModel>;
