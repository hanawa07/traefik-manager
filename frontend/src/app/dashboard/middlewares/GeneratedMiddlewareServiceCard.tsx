import Link from "next/link";

import type { Service } from "@/features/services/api/serviceApi";

import { GeneratedMiddlewareRuntimeItem } from "./GeneratedMiddlewareRuntimeItem";
import type { GeneratedMiddlewareItem } from "./middlewarePageHelpers";

interface GeneratedMiddlewareServiceCardProps {
  items: GeneratedMiddlewareItem[];
  service: Service;
}

export function GeneratedMiddlewareServiceCard({
  items,
  service,
}: GeneratedMiddlewareServiceCardProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/services/${service.id}`}
              className="text-lg font-semibold text-gray-900 hover:text-blue-700"
            >
              {service.name}
            </Link>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
              {items.length}개 자동 생성
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{service.domain}</p>
        </div>
        <Link
          href={`/dashboard/services/${service.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          서비스 설정 열기
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <GeneratedMiddlewareRuntimeItem key={`${service.id}-${item.runtimeName}`} item={item} />
        ))}
      </div>
    </article>
  );
}
