import { ShieldAlert, ShieldCheck } from "lucide-react";

import type { TraefikEncodedPathBlockSummary } from "@/features/traefik/api/traefikApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { TraefikEncodedPathBlockTrend } from "./TraefikEncodedPathBlockTrend";

interface TraefikEncodedPathBlockCardProps {
  isError: boolean;
  isLoading: boolean;
  summary?: TraefikEncodedPathBlockSummary;
  timezone?: string;
}

export function TraefikEncodedPathBlockCard({
  isError,
  isLoading,
  summary,
  timezone,
}: TraefikEncodedPathBlockCardProps) {
  const blockedCount = summary?.blocked_request_count ?? 0;
  const hasBlocks = blockedCount > 0;
  const alertActive = summary?.alert_active === true;
  const alertMonitoringEnabled = summary?.alert_monitoring_enabled !== false;
  const isUnavailable =
    !isLoading && (isError || summary?.available !== true);
  const hasWarning =
    alertActive || hasBlocks || isUnavailable || summary?.collection_available === false;
  const activeCharacters =
    !isError && summary?.available
      ? summary.encoded_characters.filter((item) => item.request_count > 0)
      : [];
  const Icon = hasWarning ? ShieldAlert : ShieldCheck;
  const tone = isLoading
    ? {
        badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      }
    : hasWarning
      ? {
          badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100",
          icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
        }
      : {
          badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-100",
          icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
        };

  return (
    <section className="card mb-4 p-4 sm:mb-6 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
              인코딩 경로 차단
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">
              Traefik이 백엔드 전달 전에 HTTP 400으로 거부한 예약 문자 경로를 24시간 보관합니다.
            </p>
          </div>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}
        >
          {isLoading
            ? "확인 중"
            : isError
              ? "확인 실패"
              : !summary?.available
                ? "로그 미연결"
                : alertActive
                  ? "급증 경고"
                : !summary.collection_available
                  ? "저장 이력"
                : `${blockedCount.toLocaleString("ko-KR")}건`}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Traefik 접근 로그를 확인하는 중입니다.</p>
        ) : isError ? (
          <p className="text-sm font-medium text-red-700 dark:text-red-200">차단 요약을 불러오지 못했습니다.</p>
        ) : !summary?.available ? (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-200">
            {summary?.message || "Traefik 접근 로그를 읽을 수 없습니다."}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {hasBlocks
                ? `비정상 또는 의심 경로 ${blockedCount.toLocaleString("ko-KR")}건을 차단했습니다.`
                : "최근 24시간 동안 차단된 예약 문자 경로가 없습니다."}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              마지막 수집 로그 {summary.observed_log_lines.toLocaleString("ko-KR")}줄 · 회차당 최대 {summary.tail_lines.toLocaleString("ko-KR")}줄
            </p>
            {!summary.collection_available ? (
              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-200">
                현재 로그 연결이 끊겨 저장된 이력을 표시합니다.
              </p>
            ) : null}
          </>
        )}
      </div>

      {!isLoading && !isError && summary?.available ? (
        <div
          className={`mt-3 rounded-xl border px-4 py-3 text-xs ${
            alertActive
              ? "border-rose-200 bg-rose-50 font-semibold text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
              : "border-gray-200 bg-white text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
          data-testid="encoded-path-block-alert-status"
        >
          {alertMonitoringEnabled
            ? `급증 감지 · 최근 ${summary.alert_window_minutes ?? 15}분 ${(summary.recent_blocked_request_count ?? 0).toLocaleString("ko-KR")}건 / 임계치 ${(summary.alert_threshold ?? 20).toLocaleString("ko-KR")}건${alertActive ? " · 경고 활성" : ""}`
            : "급증 알림 비활성화"}
        </div>
      ) : null}

      {!isError && summary?.available ? (
        <TraefikEncodedPathBlockTrend summary={summary} timezone={timezone} />
      ) : null}

      {activeCharacters.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeCharacters.map((item) => (
            <span
              key={item.encoded}
              className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
            >
              {item.encoded} {item.label} · {item.request_count.toLocaleString("ko-KR")}건
            </span>
          ))}
        </div>
      ) : null}

      {!isError && summary?.available ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          확인 {formatDateTime(summary.checked_at, timezone)}
          {summary.observed_since
            ? ` · 수집 시작 ${formatDateTime(summary.observed_since, timezone)}`
            : ""}
          {summary.last_blocked_at
            ? ` · 마지막 차단 ${formatDateTime(summary.last_blocked_at, timezone)}`
            : ""}
        </p>
      ) : null}
    </section>
  );
}
