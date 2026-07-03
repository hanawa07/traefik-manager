import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type {
  TraefikMiddlewareItem,
  TraefikMiddlewareList,
} from "@/features/traefik/api/traefikApi";

import {
  buildGeneratedMiddlewareItems,
  extractErrorMessage,
  generatedSearchValue,
} from "./middlewarePageHelpers";

export function createRuntimeMiddlewareMap(
  middlewares: TraefikMiddlewareItem[] | undefined,
) {
  return new Map((middlewares ?? []).map((middleware) => [middleware.name, middleware]));
}

export function sortMiddlewareTemplates(templates: MiddlewareTemplate[]) {
  return [...templates].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function sortServicesByName(services: Service[]) {
  return [...services].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function buildAppliedServicesByTemplate(
  sortedTemplates: MiddlewareTemplate[],
  sortedServices: Service[],
) {
  const initial = Object.fromEntries(sortedTemplates.map((template) => [template.id, [] as Service[]]));
  for (const service of sortedServices) {
    for (const templateId of service.middleware_template_ids) {
      if (initial[templateId]) {
        initial[templateId].push(service);
      }
    }
  }
  return initial;
}

export function filterServicesForMiddlewareAssignment(
  sortedServices: Service[],
  assignmentSearch: string,
) {
  const query = generatedSearchValue(assignmentSearch);
  if (!query) return sortedServices;
  return sortedServices.filter((service) =>
    generatedSearchValue(`${service.name} ${service.domain}`).includes(query),
  );
}

export function buildGeneratedServiceGroups(
  sortedServices: Service[],
  runtimeMap: Map<string, TraefikMiddlewareItem>,
  runtimeConnected: boolean,
  generatedSearch: string,
) {
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
}

export function getRuntimeBannerMessage({
  runtimeConnected,
  runtimeError,
  runtimeMiddlewaresResponse,
}: {
  runtimeConnected: boolean;
  runtimeError: unknown;
  runtimeMiddlewaresResponse: TraefikMiddlewareList | undefined;
}) {
  return runtimeError
    ? extractErrorMessage(runtimeError, "Traefik 런타임 미들웨어 상태를 불러오지 못했습니다")
    : runtimeConnected
      ? null
      : runtimeMiddlewaresResponse?.message || "Traefik 연결 상태를 아직 확인하지 못했습니다";
}

export function getSharedTabErrorState({
  isServicesError,
  isTemplateError,
  servicesError,
  templateError,
}: {
  isServicesError: boolean;
  isTemplateError: boolean;
  servicesError: unknown;
  templateError: unknown;
}) {
  return {
    sharedTabBlocked: isTemplateError || isServicesError,
    sharedTabErrorMessage: isTemplateError
      ? extractErrorMessage(templateError, "미들웨어 템플릿을 불러오지 못했습니다")
      : extractErrorMessage(servicesError, "서비스 목록을 불러오지 못했습니다"),
  };
}
