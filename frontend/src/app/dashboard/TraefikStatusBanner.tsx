import type { TraefikHealth } from "@/features/traefik/api/traefikApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface TraefikStatusBannerProps {
  health?: TraefikHealth;
  timezone?: string;
}

export function TraefikStatusBanner({ health, timezone }: TraefikStatusBannerProps) {
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
          {health?.latest_version_error ? <p className="mt-1 text-xs text-amber-700">{health.latest_version_error}</p> : null}
        </div>
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>{versionStatus}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <TraefikVersionTile label="현재 버전" value={health?.version || "-"} />
        <TraefikVersionTile label="최신 버전" value={health?.latest_version || "-"} />
        <TraefikVersionTile label="업데이트 감지" value={versionStatus} />
      </div>
    </div>
  );
}

function TraefikVersionTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/60 bg-white/60 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
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
      border: "border-red-200",
      bg: "bg-red-50",
      primary: "text-red-700",
      secondary: "text-red-600",
      badge: "bg-red-100 text-red-700",
    };
  }
  if (health?.update_available || health?.latest_version_error) {
    return {
      border: "border-amber-200",
      bg: "bg-amber-50",
      primary: "text-amber-800",
      secondary: "text-amber-700",
      badge: "bg-amber-100 text-amber-800",
    };
  }
  if (health?.connected) {
    return {
      border: "border-green-200",
      bg: "bg-green-50",
      primary: "text-green-700",
      secondary: "text-green-600",
      badge: "bg-green-100 text-green-700",
    };
  }
  return {
    border: "border-gray-200",
    bg: "bg-gray-50",
    primary: "text-gray-700",
    secondary: "text-gray-500",
    badge: "bg-gray-100 text-gray-600",
  };
}
