"use client";

import { useMemo } from "react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareList } from "@/features/traefik/api/traefikApi";

import {
  buildAppliedServicesByTemplate,
  buildGeneratedServiceGroups,
  createRuntimeMiddlewareMap,
  filterServicesForMiddlewareAssignment,
  getRuntimeBannerMessage,
  getSharedTabErrorState,
  sortMiddlewareTemplates,
  sortServicesByName,
} from "./middlewareDerivedModelHelpers";
import {
  countMiddlewareTemplateStatuses,
  filterMiddlewareTemplates,
  type TemplateStatusFilter,
} from "./middlewareTemplateFilters";

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
  templateSearch: string;
  templateStatusFilter: TemplateStatusFilter;
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
  templateSearch,
  templateStatusFilter,
  templates,
}: UseMiddlewaresPageDerivedModelArgs) {
  const runtimeConnected = runtimeMiddlewaresResponse?.connected ?? false;
  const runtimeMap = useMemo(
    () => createRuntimeMiddlewareMap(runtimeMiddlewaresResponse?.middlewares),
    [runtimeMiddlewaresResponse?.middlewares],
  );

  const sortedTemplates = useMemo(
    () => sortMiddlewareTemplates(templates),
    [templates],
  );

  const sortedServices = useMemo(
    () => sortServicesByName(services),
    [services],
  );

  const appliedServicesByTemplate = useMemo(
    () => buildAppliedServicesByTemplate(sortedTemplates, sortedServices),
    [sortedServices, sortedTemplates],
  );

  const visibleTemplates = useMemo(() => {
    return filterMiddlewareTemplates({
      appliedServicesByTemplate,
      runtimeConnected,
      runtimeMap,
      statusFilter: templateStatusFilter,
      templates: sortedTemplates,
      templateSearch,
    });
  }, [
    appliedServicesByTemplate,
    runtimeConnected,
    runtimeMap,
    sortedTemplates,
    templateSearch,
    templateStatusFilter,
  ]);

  const templateFilterCounts = useMemo(() => {
    return countMiddlewareTemplateStatuses({
      appliedServicesByTemplate,
      runtimeConnected,
      runtimeMap,
      templates: sortedTemplates,
      templateSearch,
    });
  }, [appliedServicesByTemplate, runtimeConnected, runtimeMap, sortedTemplates, templateSearch]);

  const filteredServicesForAssignment = useMemo(() => {
    return filterServicesForMiddlewareAssignment(sortedServices, assignmentSearch);
  }, [assignmentSearch, sortedServices]);

  const generatedServiceGroups = useMemo(() => {
    return buildGeneratedServiceGroups(sortedServices, runtimeMap, runtimeConnected, generatedSearch);
  }, [generatedSearch, runtimeConnected, runtimeMap, sortedServices]);

  const runtimeBannerMessage = getRuntimeBannerMessage({
    runtimeConnected,
    runtimeError,
    runtimeMiddlewaresResponse,
  });
  const { sharedTabBlocked, sharedTabErrorMessage } = getSharedTabErrorState({
    isServicesError,
    isTemplateError,
    servicesError,
    templateError,
  });

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
    templateFilterCounts,
    visibleTemplates,
  };
}
