import { ExternalLink, RefreshCw } from "lucide-react";

import type { TraefikDeploymentStatus, TraefikHealth } from "@/features/traefik/api/traefikApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { TraefikUpdatePlanPanel } from "./TraefikUpdatePlanPanel";

interface TraefikStatusBannerProps {
  deployment?: TraefikDeploymentStatus;
  health?: TraefikHealth;
  isRefreshingLatest?: boolean;
  onRefreshLatest?: () => void;
  refreshLatestError?: string | null;
  timezone?: string;
}

export function TraefikStatusBanner({
  deployment,
  health,
  isRefreshingLatest = false,
  onRefreshLatest,
  refreshLatestError,
  timezone,
}: TraefikStatusBannerProps) {
  const tone = getTraefikStatusTone(health);
  const versionStatus = getTraefikVersionStatus(health);

  return (
    <div className={`mb-6 rounded-lg border px-4 py-3 ${tone.border} ${tone.bg}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`text-sm font-medium ${tone.primary}`}>
            Traefik 상태: {health?.connected === undefined ? "확인 중" : health.connected ? "연결됨" : "연결 안 됨"}
          </p>
          <p className={`text-xs mt-1 ${tone.secondary}`}>
            {health?.message || "Traefik 상태를 확인하는 중입니다"}
            {health?.latest_version_checked_at
              ? ` · 최신 버전 확인 ${formatDateTime(health.latest_version_checked_at, timezone)}`
              : ""}
          </p>
          {health?.latest_version_error ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">{health.latest_version_error}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRefreshLatest ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
              disabled={isRefreshingLatest}
              onClick={onRefreshLatest}
              type="button"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingLatest ? "animate-spin" : ""}`} />
              {isRefreshingLatest ? "재확인 중" : "최신 재확인"}
            </button>
          ) : null}
          <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>{versionStatus}</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <TraefikVersionTile label="현재 버전" value={health?.version || "-"} />
        <TraefikVersionTile href={health?.latest_release_url || undefined} label="최신 버전" value={health?.latest_version || "-"} />
        <TraefikVersionTile label="업데이트 감지" value={versionStatus} />
      </div>
      {refreshLatestError ? (
        <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-200">{refreshLatestError}</p>
      ) : null}
      <TraefikUpdatePlanPanel deployment={deployment} health={health} />
    </div>
  );
}

function TraefikVersionTile({ href, label, value }: { href?: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/60 bg-white/60 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/70">
      <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
      {href ? (
        <a
          className="mt-1 inline-flex max-w-full items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          <span className="truncate">{value}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-slate-100">{value}</p>
      )}
    </div>
  );
}

function getTraefikVersionStatus(health?: TraefikHealth) {
  if (health?.update_available === true) return "업데이트 필요";
  if (health?.update_available === false) return "최신 상태";
  if (health?.latest_version_error) return "확인 실패";
  return "확인 중";
}

function getTraefikStatusTone(health?: TraefikHealth) {
  if (health?.connected === false) {
    return {
      border: "border-red-200 dark:border-red-500/30",
      bg: "bg-red-50 dark:bg-red-500/10",
      primary: "text-red-700 dark:text-red-200",
      secondary: "text-red-600 dark:text-red-300",
      badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
    };
  }
  if (health?.update_available || health?.latest_version_error) {
    return {
      border: "border-amber-200 dark:border-amber-500/30",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      primary: "text-amber-800 dark:text-amber-100",
      secondary: "text-amber-700 dark:text-amber-200",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
    };
  }
  if (health?.connected) {
    return {
      border: "border-green-200 dark:border-emerald-500/30",
      bg: "bg-green-50 dark:bg-emerald-500/10",
      primary: "text-green-700 dark:text-emerald-200",
      secondary: "text-green-600 dark:text-emerald-300",
      badge: "bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    };
  }
  return {
    border: "border-gray-200 dark:border-slate-700",
    bg: "bg-gray-50 dark:bg-slate-900",
    primary: "text-gray-700 dark:text-slate-200",
    secondary: "text-gray-500 dark:text-slate-400",
    badge: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300",
  };
}
