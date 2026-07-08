import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareItem } from "@/features/traefik/api/traefikApi";

import {
  generatedSearchValue,
  getTemplateConfigSummary,
  getTemplateTypeLabel,
  mapRuntimeStatus,
  type BadgeStatus,
} from "./middlewarePageHelpers";

export type TemplateStatusFilter = "all" | "active" | "inactive" | "attention";

export function isTemplateStatusFilter(value: string | null): value is TemplateStatusFilter {
  return value === "all" || value === "active" || value === "inactive" || value === "attention";
}

export function getSharedTemplateStatus({
  appliedServices,
  runtimeConnected,
  runtimeMap,
  template,
}: {
  appliedServices: Service[];
  runtimeConnected: boolean;
  runtimeMap: Map<string, TraefikMiddlewareItem>;
  template: MiddlewareTemplate;
}): BadgeStatus {
  if (appliedServices.length === 0) return "inactive";
  return mapRuntimeStatus(runtimeMap.get(`${template.shared_name}@file`), { runtimeConnected });
}

export function filterMiddlewareTemplates({
  appliedServicesByTemplate,
  runtimeConnected,
  runtimeMap,
  statusFilter,
  templates,
  templateSearch,
}: {
  appliedServicesByTemplate: Record<string, Service[]>;
  runtimeConnected: boolean;
  runtimeMap: Map<string, TraefikMiddlewareItem>;
  statusFilter: TemplateStatusFilter;
  templates: MiddlewareTemplate[];
  templateSearch: string;
}) {
  const query = generatedSearchValue(templateSearch);

  return templates.filter((template) => {
    const appliedServices = appliedServicesByTemplate[template.id] || [];
    if (query && !getTemplateSearchValue(template, appliedServices).includes(query)) {
      return false;
    }

    if (statusFilter === "all") return true;

    const status = getSharedTemplateStatus({
      appliedServices,
      runtimeConnected,
      runtimeMap,
      template,
    });
    return statusFilter === "attention"
      ? status === "warning" || status === "error" || status === "pending"
      : status === statusFilter;
  });
}

export function countMiddlewareTemplateStatuses({
  appliedServicesByTemplate,
  runtimeConnected,
  runtimeMap,
  templates,
  templateSearch,
}: Omit<Parameters<typeof filterMiddlewareTemplates>[0], "statusFilter">) {
  const searchableTemplates = filterMiddlewareTemplates({
    appliedServicesByTemplate,
    runtimeConnected,
    runtimeMap,
    statusFilter: "all",
    templates,
    templateSearch,
  });

  return searchableTemplates.reduce(
    (counts, template) => {
      const status = getSharedTemplateStatus({
        appliedServices: appliedServicesByTemplate[template.id] || [],
        runtimeConnected,
        runtimeMap,
        template,
      });
      counts.all += 1;
      if (status === "active") counts.active += 1;
      else if (status === "inactive") counts.inactive += 1;
      else counts.attention += 1;
      return counts;
    },
    { all: 0, active: 0, inactive: 0, attention: 0 },
  );
}

function getTemplateSearchValue(template: MiddlewareTemplate, appliedServices: Service[]) {
  return generatedSearchValue(
    [
      template.name,
      template.shared_name,
      getTemplateTypeLabel(template.type),
      getTemplateConfigSummary(template),
      ...appliedServices.flatMap((service) => [service.name, service.domain]),
    ].join(" "),
  );
}
