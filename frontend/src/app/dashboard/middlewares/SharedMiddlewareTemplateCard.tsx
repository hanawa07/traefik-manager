import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareItem } from "@/features/traefik/api/traefikApi";
import StatusBadge from "@/shared/components/StatusBadge";

import { SharedMiddlewareAppliedServices } from "./SharedMiddlewareAppliedServices";
import { SharedMiddlewareTemplateActions } from "./SharedMiddlewareTemplateActions";
import {
  getTemplateConfigSummary,
  getTemplateTypeLabel,
  mapRuntimeStatus,
  type BadgeStatus,
} from "./middlewarePageHelpers";

interface SharedMiddlewareTemplateCardProps {
  canManage: boolean;
  runtimeConnected: boolean;
  template: MiddlewareTemplate;
  appliedServices: Service[];
  runtimeMap: Map<string, TraefikMiddlewareItem>;
  onEdit: (template: MiddlewareTemplate) => void;
  onDelete: (template: MiddlewareTemplate) => void;
  onAssign: (template: MiddlewareTemplate) => void;
}

export default function SharedMiddlewareTemplateCard({
  canManage,
  runtimeConnected,
  template,
  appliedServices,
  runtimeMap,
  onEdit,
  onDelete,
  onAssign,
}: SharedMiddlewareTemplateCardProps) {
  const sharedRuntime = runtimeMap.get(`${template.shared_name}@file`);
  const templateStatus: BadgeStatus =
    appliedServices.length === 0
      ? "inactive"
      : mapRuntimeStatus(sharedRuntime, { runtimeConnected });

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {getTemplateTypeLabel(template.type)}
            </span>
            <StatusBadge status={templateStatus} />
            <span className="text-xs text-gray-400">{appliedServices.length}개 서비스 적용</span>
          </div>
          <p className="mt-2 font-mono text-xs text-gray-500">{template.shared_name}@file</p>
          <p className="mt-2 text-sm text-gray-600">{getTemplateConfigSummary(template)}</p>
        </div>

        {canManage ? (
          <SharedMiddlewareTemplateActions
            template={template}
            onAssign={onAssign}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ) : null}
      </div>

      <SharedMiddlewareAppliedServices services={appliedServices} />

      {appliedServices.length > 0 ? (
        <p className="mt-4 text-xs text-gray-500">
          템플릿을 수정하면 연결된 서비스 YAML이 즉시 다시 생성되어 Traefik에 반영됩니다.
        </p>
      ) : null}
    </article>
  );
}
