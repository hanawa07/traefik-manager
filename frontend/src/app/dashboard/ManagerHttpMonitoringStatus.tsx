import type {
  ManagerHttpErrorMonitorStatus,
  ManagerSettingsHistoryLatencyStatus,
} from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface ManagerHttpMonitoringStatusProps {
  latencyMonitor?: ManagerSettingsHistoryLatencyStatus | null;
  monitor?: ManagerHttpErrorMonitorStatus | null;
  timezone?: string;
}

export function ManagerHttpMonitoringStatus({
  latencyMonitor,
  monitor,
  timezone,
}: ManagerHttpMonitoringStatusProps) {
  return (
    <>
      <HttpErrorMonitorStatus monitor={monitor} timezone={timezone} />
      <SettingsHistoryLatencyStatus monitor={latencyMonitor} timezone={timezone} />
    </>
  );
}

function HttpErrorMonitorStatus({
  monitor,
  timezone,
}: {
  monitor?: ManagerHttpErrorMonitorStatus | null;
  timezone?: string;
}) {
  const status = !monitor
    ? "loading"
    : !monitor.enabled
      ? "disabled"
      : !monitor.checked_at
        ? "pending"
        : !monitor.available
          ? "unavailable"
          : monitor.breached
            ? "breached"
            : "healthy";
  const statusLabel = {
    loading: "확인 중",
    disabled: "비활성",
    pending: "첫 점검 대기",
    unavailable: "점검 실패",
    breached: "임계치 초과",
    healthy: "정상",
  }[status];
  const statusClass =
    status === "healthy"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
      : status === "breached" || status === "unavailable"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
        : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  return (
    <div
      className={`border-b px-4 py-3 text-xs ${statusClass}`}
      data-http-error-monitor-status={status}
      data-testid="manager-http-error-monitor-status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>임계치 감지 상태: {statusLabel}</strong>
        <span>마지막 점검: {formatDateTime(monitor?.checked_at, timezone)}</span>
      </div>
      {monitor ? (
        <p className="mt-1">
          최근 {monitor.window_minutes}분 · 404 {monitor.not_found_count}/
          {monitor.not_found_threshold} · 5xx {monitor.server_error_count}/
          {monitor.server_error_threshold} · 제외 경로 {monitor.excluded_paths.length}개
        </p>
      ) : null}
    </div>
  );
}

function SettingsHistoryLatencyStatus({
  monitor,
  timezone,
}: {
  monitor?: ManagerSettingsHistoryLatencyStatus | null;
  timezone?: string;
}) {
  const status = !monitor
    ? "loading"
    : !monitor.enabled
      ? "disabled"
      : !monitor.checked_at
        ? "pending"
        : !monitor.available
          ? "unavailable"
          : monitor.alert_active
            ? "breached"
            : !monitor.ready
              ? "sampling"
              : "healthy";
  const statusLabel = {
    loading: "확인 중",
    disabled: "비활성",
    pending: "첫 점검 대기",
    unavailable: "로그 확인 실패",
    sampling: "표본 수집 중",
    breached: "기준 초과",
    healthy: "정상",
  }[status];
  const statusClass = status === "healthy"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
    : status === "breached" || status === "unavailable"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  return (
    <div
      className={`border-b px-4 py-3 text-xs ${statusClass}`}
      data-settings-history-latency-status={status}
      data-testid="manager-settings-history-latency-status"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>설정 이력 API p95: {statusLabel}</strong>
        <span>마지막 점검: {formatDateTime(monitor?.checked_at, timezone)}</span>
      </div>
      {monitor ? (
        <p className="mt-1">
          최근 {monitor.window_minutes}분 · p95 {formatLatency(monitor.p95_ms)}/
          {formatLatency(monitor.threshold_ms)} · 표본 {monitor.sample_count}/
          {monitor.minimum_sample_count}건
        </p>
      ) : null}
    </div>
  );
}

function formatLatency(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${Math.round(value * 10) / 10}ms`;
}
