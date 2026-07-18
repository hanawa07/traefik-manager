import Link from "next/link";
import { TimerReset } from "lucide-react";

import {
  MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_LIMIT,
  MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_WARNING_COUNT,
  type ManagerDeploymentBottleneckAlert,
} from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS, formatManagerDeploymentDurationMs } from "./managerDeploymentHistoryDisplay";
import { getManagerApiAuditUrl } from "./managerAuditLinks";
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
  const retainedEventCount = alert.retained_event_count ?? alert.events?.length ?? 0;
  const storageWarning = alert.storage_warning_active
    || retainedEventCount >= MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_WARNING_COUNT;
  const failed = alert.status === "request_failed" || isExternalWatchdogRunFailure(alert.run_conclusion);
  const warning = alert.status === "pending" || alert.status === "alerted" || Boolean(alert.run_error) || storageWarning;
  const tone = failed
    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100"
    : warning
      ? "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
  const settingsDiffer = alert.configured_threshold_ms !== alert.effective_threshold_ms
    || alert.configured_consecutive_count !== alert.effective_consecutive_count
    || alert.configured_event_retention_days !== alert.effective_event_retention_days;
  const overrideLabels = [
    ...(alert.threshold_source === "environment" ? ["단계 소요 기준"] : []),
    ...(alert.consecutive_source === "environment" ? ["연속 감지 기준"] : []),
    ...(alert.event_retention_source === "environment" ? ["이벤트 보관 기간"] : []),
  ];
  const runLabel = getExternalWatchdogRunLabel(
    alert.run_status,
    alert.run_conclusion,
    alert.run_error,
  );
  const storageRunLabel = getExternalWatchdogRunLabel(
    alert.storage_warning_run_status,
    alert.storage_warning_run_conclusion,
    alert.storage_warning_run_error,
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
        {` · 이벤트 ${alert.effective_event_retention_days}일 보관`}
        {alert.checked_at ? ` · 마지막 검사 ${formatDateTime(alert.checked_at, timezone)}` : ""}
      </p>
      <p className="mt-1" data-manager-deployment-bottleneck-source>
        {overrideLabels.length > 0
          ? `적용 출처: 호스트 환경 변수 우선 (${overrideLabels.join(", ")})`
          : "적용 출처: 설정 화면 저장값"}
      </p>
      <p className="mt-1" data-manager-deployment-bottleneck-storage>
        이력 보관 {retainedEventCount}/{MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_LIMIT}건
        {retainedEventCount > 0
          ? ` · ${formatDateTime(alert.oldest_event_at, timezone)} ~ ${formatDateTime(alert.newest_event_at, timezone)}`
          : " · 보관된 이벤트 없음"}
      </p>
      {storageWarning ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold" data-manager-deployment-bottleneck-storage-warning>
            이력 보관 한도에 가까움 · 설정에서 보관 기간을 줄이거나 오래된 이벤트를 정리하세요.
          </p>
          <Link
            className="font-semibold underline underline-offset-2"
            data-testid="manager-deployment-bottleneck-storage-audit-link"
            href={getManagerApiAuditUrl("deployment-bottleneck-storage")}
          >
            관련 감사 이력 보기
          </Link>
        </div>
      ) : null}
      {alert.storage_warning_run_url ? (
        <p className="mt-1" data-manager-deployment-bottleneck-storage-run>
          <a
            className="font-semibold underline underline-offset-2"
            href={alert.storage_warning_run_url}
            rel="noreferrer"
            target="_blank"
          >
            보관 경고 워크플로 {storageRunLabel}
          </a>
          {alert.storage_warning_run_checked_at
            ? ` · 확인 ${formatDateTime(alert.storage_warning_run_checked_at, timezone)}`
            : ""}
          {alert.storage_warning_run_error ? ` · ${alert.storage_warning_run_error}` : ""}
        </p>
      ) : null}
      {settingsDiffer ? (
        <p className="mt-1 font-semibold" data-manager-deployment-bottleneck-override>
          {overrideLabels.length > 0
            ? "설정 화면 값과 실제 적용값이 다릅니다. 위 호스트 환경 변수 값이 우선합니다."
            : "설정 화면 값과 마지막 검사 적용값이 다릅니다. 다음 배포 검사에서 반영됩니다."}
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
      <ManagerDeploymentBottleneckEventHistory
        events={alert.events ?? []}
        retainedEventCount={retainedEventCount}
        timezone={timezone}
      />
    </section>
  );
}
