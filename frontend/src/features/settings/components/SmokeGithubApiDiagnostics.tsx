import { RefreshCw } from "lucide-react";
import Link from "next/link";

import { useAuditPage } from "@/features/audit/hooks/useAudit";
import type { SmokeRotationStatus } from "@/features/settings/api/settingsApi";
import { isGithubSecondaryRateLimitBlocked } from "@/features/settings/lib/smokeGithubRateLimit";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface SmokeGithubApiDiagnosticsProps {
  canManage: boolean;
  isRefreshBlocked: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  status: SmokeRotationStatus;
  timezone?: string;
}

export function SmokeGithubApiDiagnostics({
  canManage,
  isRefreshBlocked,
  isRefreshing,
  onRefresh,
  status,
  timezone,
}: SmokeGithubApiDiagnosticsProps) {
  const hits = status.monitoring_github_history_cache_hits;
  const misses = status.monitoring_github_history_cache_misses;
  const lookups = hits !== null && misses !== null ? hits + misses : null;
  const hitRate = lookups && hits !== null ? Math.round((hits / lookups) * 1000) / 10 : null;
  const requestEstimate = status.monitoring_github_last_request_count;
  const secondaryBlocked = isGithubSecondaryRateLimitBlocked(
    status.monitoring_github_secondary_limit_retry_at,
  );
  const rateLimitAudit = useAuditPage({
    event: "github_api_rate_limit",
    limit: 1,
    offset: 0,
  });
  const latestRateLimitAudit = rateLimitAudit.data?.items[0];
  const occurrenceCount = latestRateLimitAudit?.detail?.occurrence_count;
  const occurredAt = latestRateLimitAudit?.detail?.occurred_at;
  const latestOccurredAt = typeof occurredAt === "string"
    ? occurredAt
    : latestRateLimitAudit?.created_at;
  const latestKind = latestRateLimitAudit?.event === "github_api_primary_rate_limit"
    ? "기본 요청 한도"
    : latestRateLimitAudit?.event === "github_api_secondary_rate_limit"
      ? "보조 요청 제한"
      : null;
  const auditStatus = rateLimitAudit.isError
    ? "error"
    : rateLimitAudit.data
      ? "ready"
      : "loading";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-950">
      <div className="space-y-1 text-xs text-gray-500 dark:text-slate-400">
        <p>
          GitHub 이력 확인 {formatDateTime(status.monitoring_history_checked_at, timezone)} · 10분간 캐시
        </p>
        <p
          className={latestRateLimitAudit ? "font-semibold text-amber-700 dark:text-amber-300" : undefined}
          data-latest-kind={latestKind || ""}
          data-occurred-at={latestOccurredAt || ""}
          data-occurrence-count={typeof occurrenceCount === "number" ? occurrenceCount : ""}
          data-status={auditStatus}
          data-testid="smoke-github-rate-limit-audit-summary"
          data-total={rateLimitAudit.data?.total ?? ""}
        >
          {auditStatus === "error"
            ? "최근 제한 이력을 불러오지 못했습니다."
            : auditStatus === "loading"
              ? "최근 제한 이력 확인 중..."
              : latestRateLimitAudit && latestKind && latestOccurredAt
                ? `최근 제한 ${latestKind} · ${formatDateTime(latestOccurredAt, timezone)} · ${typeof occurrenceCount === "number" ? `종류별 누적 ${occurrenceCount}회 · ` : ""}전체 누적 ${rateLimitAudit.data?.total ?? 0}회`
                : "최근 제한 기록 없음 · 전체 누적 0회"}
        </p>
        {status.monitoring_github_rate_limit_remaining !== null &&
        status.monitoring_github_rate_limit_limit !== null ? (
          <p
            className={isRefreshBlocked ? "font-semibold text-amber-700 dark:text-amber-300" : undefined}
            data-testid="smoke-github-rate-limit"
          >
            GitHub API {status.monitoring_github_rate_limit_remaining}/
            {status.monitoring_github_rate_limit_limit}회 남음 · 보호 기준 {status.monitoring_github_refresh_reserve}회 · 초기화 {formatDateTime(
              status.monitoring_github_rate_limit_reset_at,
              timezone,
            )}
          </p>
        ) : null}
        {status.monitoring_github_history_cache_items !== null &&
        status.monitoring_github_history_cache_capacity !== null ? (
          <p data-testid="smoke-github-cache-diagnostics">
            현재 프로세스 응답 캐시 {status.monitoring_github_history_cache_items}/
            {status.monitoring_github_history_cache_capacity}개 · 적중률 {hitRate === null ? "계산 전" : `${hitRate}%`}
            {lookups ? ` (${hits}/${lookups}회)` : ""}
          </p>
        ) : null}
        {requestEstimate !== null ? (
          <p data-testid="smoke-github-request-estimate">
            직전 조회 총 {requestEstimate}회 · Workflow {status.monitoring_github_last_workflow_request_count ?? 0}회 · Job {status.monitoring_github_last_job_request_count ?? 0}회 · Artifact {status.monitoring_github_last_artifact_request_count ?? 0}회 · 지금 새로고침 약 {requestEstimate}회 · 자동 결과 확인 30초마다 약 {requestEstimate}회
            (최대 12번) · 검색·필터는 캐시 적중 시 0회
          </p>
        ) : null}
        {secondaryBlocked ? (
          <p
            className="font-semibold text-amber-700 dark:text-amber-300"
            data-testid="smoke-github-rate-limit-warning"
          >
            GitHub API 보조 제한으로 새로고침을 잠갔습니다. 시간당 잔여량과 별개이며 {formatDateTime(
              status.monitoring_github_secondary_limit_retry_at,
              timezone,
            )} 이후 자동 해제됩니다.
          </p>
        ) : isRefreshBlocked ? (
          <p
            className="font-semibold text-amber-700 dark:text-amber-300"
            data-testid="smoke-github-rate-limit-warning"
          >
            잔여량 보호를 위해 수동 새로고침과 자동 결과 확인을 잠갔습니다.
          </p>
        ) : null}
        <p>
          <Link
            className="font-semibold text-cyan-700 underline underline-offset-2 dark:text-cyan-300"
            data-testid="smoke-github-audit-link"
            href="/dashboard/audit?filter=github_api_rate_limit"
          >
            GitHub API 제한 감사 로그 보기
          </Link>
        </p>
      </div>
      {canManage ? (
        <button
          type="button"
          className="btn-secondary flex items-center justify-center gap-1.5 py-1.5 text-xs"
          data-testid="smoke-history-refresh"
          onClick={onRefresh}
          disabled={isRefreshing || isRefreshBlocked}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "확인 중" : "지금 새로고침"}
        </button>
      ) : null}
    </div>
  );
}
