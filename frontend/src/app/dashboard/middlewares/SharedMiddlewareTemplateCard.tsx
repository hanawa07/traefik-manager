import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareItem } from "@/features/traefik/api/traefikApi";
import StatusBadge from "@/shared/components/StatusBadge";

import { SharedMiddlewareAppliedServices } from "./SharedMiddlewareAppliedServices";
import { SharedMiddlewareTemplateActions } from "./SharedMiddlewareTemplateActions";
import {
  getTemplateConfigSummary,
  getTemplateTypeLabel,
} from "./middlewarePageHelpers";
import { getSharedTemplateStatus } from "./middlewareTemplateFilters";

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
  const templateStatus = getSharedTemplateStatus({
    appliedServices,
    runtimeConnected,
    runtimeMap,
    template,
  });
  const runtimeUsedByCount = sharedRuntime?.used_by.length ?? 0;

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{template.name}</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
              {getTemplateTypeLabel(template.type)}
            </span>
            <StatusBadge status={templateStatus} />
            <span className="text-xs text-gray-400 dark:text-slate-500">{appliedServices.length}개 서비스 적용</span>
          </div>
          <p className="mt-2 font-mono text-xs text-gray-500 dark:text-slate-400">{template.shared_name}@file</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{getTemplateConfigSummary(template)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <RuntimeSummaryPill label="DB 적용" value={`${appliedServices.length}개 서비스`} />
            <RuntimeSummaryPill
              label="런타임 사용"
              value={runtimeConnected ? `${runtimeUsedByCount}개 라우터` : "확인 중"}
            />
            <RuntimeSummaryPill
              label="동기화"
              value={getRuntimeSyncLabel({
                appliedServicesCount: appliedServices.length,
                runtimeConnected,
                runtimeUsedByCount,
                sharedRuntime,
              })}
            />
          </div>
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
        <p className="mt-4 text-xs text-gray-500 dark:text-slate-400">
          템플릿을 수정하면 연결된 서비스 YAML이 즉시 다시 생성되어 Traefik에 반영됩니다.
        </p>
      ) : null}
    </article>
  );
}

function RuntimeSummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
      {label}: <span className="font-semibold text-gray-800 dark:text-slate-100">{value}</span>
    </span>
  );
}

function getRuntimeSyncLabel({
  appliedServicesCount,
  runtimeConnected,
  runtimeUsedByCount,
  sharedRuntime,
}: {
  appliedServicesCount: number;
  runtimeConnected: boolean;
  runtimeUsedByCount: number;
  sharedRuntime?: TraefikMiddlewareItem;
}) {
  if (appliedServicesCount === 0) return "미적용";
  if (!runtimeConnected) return "확인 중";
  if (!sharedRuntime) return "런타임 없음";
  return runtimeUsedByCount === appliedServicesCount
    ? "일치"
    : `${runtimeUsedByCount}/${appliedServicesCount}`;
}
