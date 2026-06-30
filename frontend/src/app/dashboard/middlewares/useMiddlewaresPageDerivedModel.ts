"use client";

import { useMemo } from "react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareList } from "@/features/traefik/api/traefikApi";

import {
  buildGeneratedMiddlewareItems,
  extractErrorMessage,
  generatedSearchValue,
} from "./middlewarePageHelpers";

interface UseMiddlewaresPageDerivedModelArgs {
  assignmentSearch: string;
  generatedSearch: string;
  isServicesError: boolean;
  isTemplateError: boolean;
  runtimeError: unknown;
  runtimeMiddlewaresResponse: TraefikMiddlewareList | undefined;
  services: Service[];
  servicesError: unknown;
  templateError: unknown;
  templates: MiddlewareTemplate[];
}

export function useMiddlewaresPageDerivedModel({
  assignmentSearch,
  generatedSearch,
  isServicesError,
  isTemplateError,
  runtimeError,
  runtimeMiddlewaresResponse,
  services,
  servicesError,
  templateError,
  templates,
}: UseMiddlewaresPageDerivedModelArgs) {
  const runtimeConnected = runtimeMiddlewaresResponse?.connected ?? false;
  const runtimeMap = useMemo(
    () =>
      new Map(
        (runtimeMiddlewaresResponse?.middlewares ?? []).map((middleware) => [middleware.name, middleware]),
      ),
    [runtimeMiddlewaresResponse?.middlewares],
  );

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [templates],
  );

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [services],
  );

  const appliedServicesByTemplate = useMemo(() => {
    const initial = Object.fromEntries(sortedTemplates.map((template) => [template.id, [] as Service[]]));
    for (const service of sortedServices) {
      for (const templateId of service.middleware_template_ids) {
        if (initial[templateId]) {
          initial[templateId].push(service);
        }
      }
    }
    return initial;
  }, [sortedServices, sortedTemplates]);

  const filteredServicesForAssignment = useMemo(() => {
    const query = generatedSearchValue(assignmentSearch);
    if (!query) return sortedServices;
    return sortedServices.filter((service) =>
      generatedSearchValue(`${service.name} ${service.domain}`).includes(query),
    );
  }, [assignmentSearch, sortedServices]);

  const generatedServiceGroups = useMemo(() => {
    const query = generatedSearchValue(generatedSearch);

    return sortedServices
      .map((service) => ({
        service,
        items: buildGeneratedMiddlewareItems(service, runtimeMap, runtimeConnected),
      }))
      .filter(({ service, items }) => {
        if (items.length === 0) return false;
        if (!query) return true;
        return generatedSearchValue(`${service.name} ${service.domain}`).includes(query);
      });
  }, [generatedSearch, runtimeConnected, runtimeMap, sortedServices]);

  const runtimeBannerMessage = runtimeError
    ? extractErrorMessage(runtimeError, "Traefik 런타임 미들웨어 상태를 불러오지 못했습니다")
    : runtimeConnected
      ? null
      : runtimeMiddlewaresResponse?.message || "Traefik 연결 상태를 아직 확인하지 못했습니다";
  const sharedTabBlocked = isTemplateError || isServicesError;
  const sharedTabErrorMessage = isTemplateError
    ? extractErrorMessage(templateError, "미들웨어 템플릿을 불러오지 못했습니다")
    : extractErrorMessage(servicesError, "서비스 목록을 불러오지 못했습니다");

  return {
    appliedServicesByTemplate,
    filteredServicesForAssignment,
    generatedServiceGroups,
    runtimeBannerMessage,
    runtimeConnected,
    runtimeMap,
    sharedTabBlocked,
    sharedTabErrorMessage,
    sortedTemplates,
  };
}
