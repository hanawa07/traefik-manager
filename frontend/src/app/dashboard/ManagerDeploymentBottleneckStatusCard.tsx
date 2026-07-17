import { TimerReset } from "lucide-react";

import type { ManagerDeploymentBottleneckAlert } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS, formatManagerDeploymentDurationMs } from "./managerDeploymentHistoryDisplay";
import { getExternalWatchdogRunLabel, isExternalWatchdogRunFailure } from "./managerWatchdogStatus";
import { ManagerDeploymentBottleneckEventHistory } from "./ManagerDeploymentBottleneckEventHistory";

interface ManagerDeploymentBottleneckStatusCardProps {
  alert?: ManagerDeploymentBottleneckAlert;
  timezone?: string;
}

const STATUS_LABELS: Record<ManagerDeploymentBottleneckAlert["status"], string> = {
  not_checked: "검사 전",
  no_history: "이력 없음",
  normal: "정상",
  pending: "연속 관찰 중",
  alerted: "알림 요청됨",
  request_failed: "알림 요청 실패",
};

export function ManagerDeploymentBottleneckStatusCard({
  alert,
  timezone,
}: ManagerDeploymentBottleneckStatusCardProps) {
  if (!alert) return null;
  const failed = alert.status === "request_failed" || isExternalWatchdogRunFailure(alert.run_conclusion);
  const warning = alert.status === "pending" || alert.status === "alerted" || Boolean(alert.run_error);
  const tone = failed
    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100"
    : warning
      ? "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
  const settingsDiffer = alert.configured_threshold_ms !== alert.effective_threshold_ms
    || alert.configured_consecutive_count !== alert.effective_consecutive_count;
  const runLabel = getExternalWatchdogRunLabel(
    alert.run_status,
    alert.run_conclusion,
    alert.run_error,
  );

  return (
    <section
      className={`mt-4 rounded-xl border px-4 py-3 text-xs ${tone}`}
      data-manager-deployment-bottleneck-status={alert.status}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <TimerReset className="h-4 w-4" /> 배포 병목 운영 알림
        </p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold dark:bg-slate-950/40">
          {STATUS_LABELS[alert.status]}
        </span>
      </div>
      <p className="mt-2">
        실제 검사 기준 {formatManagerDeploymentDurationMs(alert.effective_threshold_ms)} 초과 · 연속 {alert.current_consecutive_count}/{alert.effective_consecutive_count}회
        {alert.checked_at ? ` · 마지막 검사 ${formatDateTime(alert.checked_at, timezone)}` : ""}
      </p>
      {settingsDiffer ? (
        <p className="mt-1 font-semibold" data-manager-deployment-bottleneck-override>
          설정 화면 값과 실제 적용값이 다릅니다. 호스트 환경 변수 우선 적용 여부를 확인하세요.
        </p>
      ) : null}
      {alert.slowest_stage && alert.current_consecutive_count > 0 ? (
        <p className="mt-1">
          최근 {alert.latest_version || "배포"} · {MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[alert.slowest_stage]} 최대 {formatManagerDeploymentDurationMs(alert.slowest_ms)}
        </p>
      ) : null}
      {alert.run_url ? (
        <p className="mt-1">
          <a className="font-semibold underline underline-offset-2" href={alert.run_url} rel="noreferrer" target="_blank">
            알림 워크플로 {runLabel}
          </a>
          {alert.run_checked_at ? ` · 확인 ${formatDateTime(alert.run_checked_at, timezone)}` : ""}
          {alert.run_error ? ` · ${alert.run_error}` : ""}
        </p>
      ) : null}
      <ManagerDeploymentBottleneckEventHistory events={alert.events ?? []} timezone={timezone} />
    </section>
  );
}
