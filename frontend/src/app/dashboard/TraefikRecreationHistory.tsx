import { RotateCw, ShieldAlert, ShieldCheck } from "lucide-react";

import type { TraefikRecreationHistoryEntry } from "@/features/traefik/api/traefikApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface TraefikRecreationHistoryProps {
  entries: TraefikRecreationHistoryEntry[];
  timezone?: string;
}

const SOURCE_LABELS: Record<TraefikRecreationHistoryEntry["source"], string> = {
  patch_update: "패치 업데이트",
  rollback: "자동 롤백",
  manual_safe: "수동 안전 경로",
  direct_or_unknown: "안전 경로 외부",
};

export function TraefikRecreationHistory({
  entries,
  timezone,
}: TraefikRecreationHistoryProps) {
  const unmanagedCount = entries.filter((entry) => entry.status === "unmanaged").length;

  return (
    <section
      className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700"
      data-traefik-unmanaged-recreation-count={unmanagedCount}
      data-testid="traefik-recreation-history"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
          <RotateCw className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
          컨테이너 재생성 이력
        </p>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
            unmanagedCount
              ? "text-rose-700 dark:text-rose-300"
              : "text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {unmanagedCount ? (
            <ShieldAlert className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {unmanagedCount
            ? `최근 안전 경로 외부 ${unmanagedCount}건`
            : "안전 경로 확인됨"}
        </span>
      </div>
      {entries.length ? (
        <ol className="mt-2 divide-y divide-slate-200 text-xs dark:divide-slate-700">
          {entries.slice(0, 5).map((entry) => (
            <li
              className="grid min-w-0 gap-1 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3"
              data-traefik-recreation-status={entry.status}
              key={entry.container_id}
            >
              <span
                className={
                  entry.status === "managed"
                    ? "font-semibold text-emerald-700 dark:text-emerald-300"
                    : "font-semibold text-rose-700 dark:text-rose-300"
                }
              >
                {entry.status === "managed" ? "관리됨" : "경로 외부"}
              </span>
              <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                {SOURCE_LABELS[entry.source]} · {entry.image} · {entry.container_id.slice(0, 12)}
                {entry.actor ? ` · ${entry.actor}` : ""}
              </span>
              <time className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatDateTime(entry.observed_at, timezone)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          기준선 설정 후 발생한 재생성 이력이 없습니다.
        </p>
      )}
    </section>
  );
}
