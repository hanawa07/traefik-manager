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
  const summary = buildStatusSummary(items);

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/services/${service.id}`}
              className="text-lg font-semibold text-gray-900 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300"
            >
              {service.name}
            </Link>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-slate-800 dark:text-slate-300">
              {items.length}개 자동 생성
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{service.domain}</p>
        </div>
        <Link
          href={`/dashboard/services/${service.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
        >
          서비스 설정 열기
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <SummaryPill label="정상" value={summary.active} />
        <SummaryPill label="확인 필요" value={summary.attention} />
        <SummaryPill label="대기" value={summary.pending} />
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <GeneratedMiddlewareRuntimeItem key={`${service.id}-${item.runtimeName}`} item={item} />
        ))}
      </div>
    </article>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
      {label}: <span className="font-semibold text-gray-800 dark:text-slate-100">{value}개</span>
    </span>
  );
}

function buildStatusSummary(items: GeneratedMiddlewareItem[]) {
  return items.reduce(
    (summary, item) => {
      if (item.status === "active") summary.active += 1;
      else if (item.status === "pending") summary.pending += 1;
      else summary.attention += 1;
      return summary;
    },
    { active: 0, attention: 0, pending: 0 },
  );
}
