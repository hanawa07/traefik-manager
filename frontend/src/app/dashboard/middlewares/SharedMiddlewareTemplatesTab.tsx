import Link from "next/link";
import { Layers3, Pencil, Server, Shield, Trash2, Wand2 } from "lucide-react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareItem } from "@/features/traefik/api/traefikApi";
import StatusBadge from "@/shared/components/StatusBadge";
import {
  getTemplateConfigSummary,
  getTemplateTypeLabel,
  mapRuntimeStatus,
  type BadgeStatus,
} from "./middlewarePageHelpers";

interface SharedMiddlewareTemplatesTabProps {
  canManage: boolean;
  runtimeConnected: boolean;
  runtimeBannerMessage: string | null;
  isTemplateLoading: boolean;
  isServicesLoading: boolean;
  sharedTabBlocked: boolean;
  sharedTabErrorMessage: string;
  sortedTemplates: MiddlewareTemplate[];
  appliedServicesByTemplate: Record<string, Service[]>;
  runtimeMap: Map<string, TraefikMiddlewareItem>;
  onCreateOpen: () => void;
  onEdit: (template: MiddlewareTemplate) => void;
  onDelete: (template: MiddlewareTemplate) => void;
  onAssign: (template: MiddlewareTemplate) => void;
}

export default function SharedMiddlewareTemplatesTab({
  canManage,
  runtimeConnected,
  runtimeBannerMessage,
  isTemplateLoading,
  isServicesLoading,
  sharedTabBlocked,
  sharedTabErrorMessage,
  sortedTemplates,
  appliedServicesByTemplate,
  runtimeMap,
  onCreateOpen,
  onEdit,
  onDelete,
  onAssign,
}: SharedMiddlewareTemplatesTabProps) {
  return (
    <div className="space-y-4">
      {runtimeBannerMessage ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm font-medium text-yellow-800">Traefik 런타임 상태 확인</p>
          <p className="mt-1 text-xs text-yellow-700">{runtimeBannerMessage}</p>
        </div>
      ) : null}

      {isTemplateLoading || isServicesLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : sharedTabBlocked ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-red-300" />
          <p className="text-sm font-medium text-red-600">미들웨어 관리 화면을 불러오지 못했습니다</p>
          <p className="mt-2 text-xs text-gray-500">{sharedTabErrorMessage}</p>
        </div>
      ) : sortedTemplates.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-gray-500">
          <Layers3 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm">등록된 공유 미들웨어 템플릿이 없습니다</p>
          <p className="mt-2 text-xs text-gray-400">
            서비스별 자동 생성 미들웨어는 옆 탭에서 확인하고, 재사용할 공용 규칙만 여기서 관리합니다.
          </p>
          {canManage ? (
            <button className="mt-3 text-sm text-blue-500 hover:underline" onClick={onCreateOpen}>
              첫 번째 템플릿 추가하기
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTemplates.map((template) => (
            <SharedMiddlewareTemplateCard
              key={template.id}
              canManage={canManage}
              runtimeConnected={runtimeConnected}
              template={template}
              appliedServices={appliedServicesByTemplate[template.id] || []}
              runtimeMap={runtimeMap}
              onEdit={onEdit}
              onDelete={onDelete}
              onAssign={onAssign}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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

function SharedMiddlewareTemplateCard({
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
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm" onClick={() => onAssign(template)}>
              <Wand2 className="h-4 w-4" />
              서비스에 적용
            </button>
            <button className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm" onClick={() => onEdit(template)}>
              <Pencil className="h-4 w-4" />
              수정
            </button>
            <button
              className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm text-red-600 hover:border-red-200 hover:bg-red-50"
              onClick={() => onDelete(template)}
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <Server className="h-3.5 w-3.5" />
          적용 서비스
        </div>
        {appliedServices.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            아직 적용된 서비스가 없습니다. `서비스에 적용`에서 여러 앱에 바로 붙일 수 있습니다.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {appliedServices.map((service) => (
              <Link
                key={service.id}
                href={`/dashboard/services/${service.id}`}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <span className="font-medium">{service.name}</span>
                <span className="ml-2 text-xs text-gray-500">{service.domain}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {appliedServices.length > 0 ? (
        <p className="mt-4 text-xs text-gray-500">
          템플릿을 수정하면 연결된 서비스 YAML이 즉시 다시 생성되어 Traefik에 반영됩니다.
        </p>
      ) : null}
    </article>
  );
}
