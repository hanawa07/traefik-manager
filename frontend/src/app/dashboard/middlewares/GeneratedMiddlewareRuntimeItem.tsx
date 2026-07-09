import StatusBadge from "@/shared/components/StatusBadge";

import type { GeneratedMiddlewareItem } from "./middlewarePageHelpers";

export function GeneratedMiddlewareRuntimeItem({ item }: { item: GeneratedMiddlewareItem }) {
  return (
    <div
      className={
        "flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/70 " +
        "lg:flex-row lg:items-start lg:justify-between"
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{item.label}</p>
          {item.scope === "shared" ? (
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-200">
              공용
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-mono text-xs text-gray-500 dark:text-slate-400">{item.runtimeName}</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{item.description}</p>
      </div>
      <div className="flex flex-col items-start gap-2 lg:items-end">
        <StatusBadge status={item.status} />
        <span className="text-xs text-gray-400 dark:text-slate-500">{item.runtimeStatusLabel}</span>
      </div>
    </div>
  );
}
