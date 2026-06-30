import Link from "next/link";
import { Pencil, Server, Trash2, Wand2 } from "lucide-react";

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
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm"
              onClick={() => onAssign(template)}
            >
              <Wand2 className="h-4 w-4" />
              서비스에 적용
            </button>
            <button
              className="btn-secondary inline-flex items-center gap-1.5 py-2 text-sm"
              onClick={() => onEdit(template)}
            >
              <Pencil className="h-4 w-4" />
              수정
            </button>
            <button
              className={
                "btn-secondary inline-flex items-center gap-1.5 py-2 text-sm text-red-600 " +
                "hover:border-red-200 hover:bg-red-50"
              }
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
          <AppliedServiceLinks services={appliedServices} />
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

function AppliedServiceLinks({ services }: { services: Service[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {services.map((service) => (
        <Link
          key={service.id}
          href={`/dashboard/services/${service.id}`}
          className={
            "rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 " +
            "transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          }
        >
          <span className="font-medium">{service.name}</span>
          <span className="ml-2 text-xs text-gray-500">{service.domain}</span>
        </Link>
      ))}
    </div>
  );
}
