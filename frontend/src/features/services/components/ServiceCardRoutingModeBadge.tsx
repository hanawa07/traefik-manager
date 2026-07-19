import { CirclePause, Construction } from "lucide-react";

import type { RoutingMode } from "../api/serviceApi";

export function ServiceCardRoutingModeBadge({ routingMode }: { routingMode: RoutingMode }) {
  if (routingMode === "active") return null;

  const disabled = routingMode === "disabled";
  const Icon = disabled ? CirclePause : Construction;
  return (
    <span
      className={disabled
        ? "inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        : "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"}
    >
      <Icon className="h-3 w-3" />
      {disabled ? "라우팅 비활성" : "점검 안내 중"}
    </span>
  );
}
