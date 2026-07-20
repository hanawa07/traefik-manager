import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import type { TraefikUpdateHistoryEntry } from "@/features/traefik/api/traefikApi";
import { useRetryTraefikRollbackAlert } from "@/features/traefik/hooks/useTraefik";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  getExternalWatchdogRunLabel,
  isExternalWatchdogRunFailure,
} from "./managerWatchdogStatus";

interface TraefikUpdateAlertRunProps {
  canManage: boolean;
  entry: TraefikUpdateHistoryEntry;
  pendingRequest: boolean;
  runnerAvailable: boolean;
  timezone?: string;
}

export function TraefikUpdateAlertRun({
  canManage,
  entry,
  pendingRequest,
  runnerAvailable,
  timezone,
}: TraefikUpdateAlertRunProps) {
  const retryAlert = useRetryTraefikRollbackAlert();
  const [feedback, setFeedback] = useState("");
  const status = entry.alert_request_status;
  if (!status || status === "not_needed") return null;

  const resultLabel = getExternalWatchdogRunLabel(
    entry.alert_run_status,
    entry.alert_run_conclusion,
    entry.alert_run_error,
  );
  const failed = status === "request_failed"
    || isExternalWatchdogRunFailure(entry.alert_run_conclusion);
  const lookupFailed = Boolean(entry.alert_run_error);
  const className = failed
    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
    : lookupFailed || status === "pending"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      : "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200";
  const requestLabel = status === "request_failed"
    ? "운영 알림 요청 실패"
    : status === "pending" ? "운영 알림 요청 중" : "운영 알림 요청됨";
  const retryBlockedReason = pendingRequest
    ? "이미 처리 중인 Traefik 호스트 요청이 있습니다"
    : !runnerAvailable ? "호스트 업데이트 실행기를 사용할 수 없습니다" : undefined;

  const handleRetry = async () => {
    if (!window.confirm("자동 롤백 실패 운영 알림을 다시 요청할까요?")) return;
    setFeedback("");
    try {
      const result = await retryAlert.mutateAsync(entry.request_id);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(getRetryError(error));
    }
  };

  return (
    <div
      className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${className}`}
      data-traefik-update-alert={status}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{requestLabel}</span>
        {status === "requested" && entry.alert_run_url ? (
          <a
            className="inline-flex items-center gap-1 underline underline-offset-2"
            href={entry.alert_run_url}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-3 w-3" /> 알림 실행 {resultLabel}
          </a>
        ) : null}
        {entry.alert_run_checked_at ? (
          <span>확인 {formatDateTime(entry.alert_run_checked_at, timezone)}</span>
        ) : null}
        {entry.alert_retry_actor && entry.alert_retry_requested_at ? (
          <span data-traefik-update-alert-retry-meta>
            재시도 {entry.alert_retry_actor} · {formatDateTime(entry.alert_retry_requested_at, timezone)}
          </span>
        ) : null}
        {entry.alert_retry_request_id ? (
          <a
            className="inline-flex items-center gap-1 underline underline-offset-2"
            data-traefik-update-alert-audit={entry.alert_retry_request_id}
            href={`/dashboard/audit?q=${encodeURIComponent(entry.alert_retry_request_id)}`}
          >
            <ExternalLink className="h-3 w-3" /> 감사 로그
          </a>
        ) : null}
        {entry.alert_run_error ? <span>{entry.alert_run_error}</span> : null}
        {status === "request_failed" && canManage ? (
          <button
            className="inline-flex items-center gap-1 rounded-md border border-current/30 bg-white/70 px-2 py-1 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950/50 dark:hover:bg-slate-950"
            data-traefik-update-alert-retry={entry.request_id}
            disabled={Boolean(retryBlockedReason) || retryAlert.isPending}
            onClick={() => void handleRetry()}
            title={retryBlockedReason}
            type="button"
          >
            {retryAlert.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {retryAlert.isPending ? "재시도 요청 중" : "알림 다시 요청"}
          </button>
        ) : null}
      </div>
      {feedback ? (
        <p className="mt-1.5" role={retryAlert.isError ? "alert" : "status"}>{feedback}</p>
      ) : null}
    </div>
  );
}

function getRetryError(error: unknown): string {
  return (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    || "운영 알림 재시도를 요청하지 못했습니다";
}
