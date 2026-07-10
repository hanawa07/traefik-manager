import { Activity } from "lucide-react";
import { clsx } from "clsx";

import type { UpstreamHealth } from "../api/serviceApi";

interface ServiceCardHealthBadgesProps {
  routerActive?: boolean;
  upstreamHealth?: UpstreamHealth;
}

export function ServiceCardHealthBadges({
  routerActive,
  upstreamHealth,
}: ServiceCardHealthBadgesProps) {
  return (
    <>
      <RouterBadge routerActive={routerActive} />
      <UpstreamHealthBadge upstreamHealth={upstreamHealth} />
    </>
  );
}

function RouterBadge({ routerActive }: { routerActive?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        routerActive === undefined
          ? "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
          : routerActive
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
            : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          routerActive === undefined ? "bg-gray-400" : routerActive ? "bg-emerald-500" : "bg-rose-500",
        )}
      />
      {routerActive === undefined ? "라우터 확인 중" : routerActive ? "라우터 연결됨" : "라우터 미연결"}
    </span>
  );
}

function UpstreamHealthBadge({ upstreamHealth }: { upstreamHealth?: UpstreamHealth }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        !upstreamHealth
          ? "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          : upstreamHealth.status === "up"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
            : upstreamHealth.status === "unknown"
              ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
      )}
    >
      <Activity
        className={clsx(
          "h-3 w-3",
          !upstreamHealth
            ? "text-slate-400 dark:text-slate-500"
            : upstreamHealth.status === "up"
              ? "text-emerald-500 dark:text-emerald-300"
              : upstreamHealth.status === "unknown"
                ? "text-slate-500 dark:text-slate-400"
                : "text-rose-500 dark:text-rose-300",
        )}
      />
      {!upstreamHealth ? (
        "업스트림 확인 중"
      ) : upstreamHealth.status === "up" ? (
        <span className="flex items-center gap-0.5">
          UP
          {upstreamHealth.latency_ms !== null && (
            <span className="text-[10px] opacity-60">({upstreamHealth.latency_ms}ms)</span>
          )}
        </span>
      ) : upstreamHealth.status === "unknown" ? (
        "체크 안 함"
      ) : (
        "DOWN"
      )}
    </span>
  );
}
