"use client";

import { useEffect, useState } from "react";

import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import {
  filterAndPrioritizeSmokeArtifactRuns,
  getSmokeArtifactFilterCounts,
  getSmokeArtifactExpiryState,
  getSmokeArtifactRemainingLabel,
  type SmokeArtifactFilter,
  type SmokeArtifactExpiryState,
} from "@/shared/lib/smokeArtifactExpiry";

const STATUS_LABELS = {
  failure: "실패",
  skipped: "건너뜀",
  success: "성공",
} as const;

const ARTIFACT_EXPIRY_LABELS: Record<SmokeArtifactExpiryState, string> = {
  active: "만료",
  expiring_soon: "만료 임박",
  expired: "만료됨",
};

const ARTIFACT_EXPIRY_STYLES: Record<SmokeArtifactExpiryState, string> = {
  active: "text-slate-500 dark:text-slate-400",
  expiring_soon: "bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  expired: "bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-200",
};

const ARTIFACT_COPY_SUCCESS_DURATION_MS = 2_000;
const ARTIFACT_FILTER_STORAGE_KEY = "traefik-manager:smoke-artifact-filter";
const ARTIFACT_FILTER_QUERY = "artifact_filter";

interface SmokeFailureArtifactLinksProps {
  failedRuns: SmokeMonitoringRecentRun[];
  periodReferenceTime: number;
  timezone?: string;
  visible: boolean;
}

export function SmokeFailureArtifactLinks({
  failedRuns,
  periodReferenceTime,
  timezone,
  visible,
}: SmokeFailureArtifactLinksProps) {
  const [artifactFilter, setArtifactFilter] = useState<SmokeArtifactFilter>("all");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const queryFilter = new URLSearchParams(window.location.search).get(ARTIFACT_FILTER_QUERY);
    const storedFilter = window.localStorage.getItem(ARTIFACT_FILTER_STORAGE_KEY);
    const initialFilter = isSmokeArtifactFilter(queryFilter)
      ? queryFilter
      : isSmokeArtifactFilter(storedFilter) ? storedFilter : "all";
    setArtifactFilter(initialFilter);
    replaceArtifactFilterQuery(initialFilter);
    window.localStorage.setItem(ARTIFACT_FILTER_STORAGE_KEY, initialFilter);
  }, []);

  useEffect(() => {
    if (copyStatus !== "copied") return;
    const timeoutId = window.setTimeout(
      () => setCopyStatus("idle"),
      ARTIFACT_COPY_SUCCESS_DURATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const filteredRuns = filterAndPrioritizeSmokeArtifactRuns(
    failedRuns,
    artifactFilter,
    periodReferenceTime,
  );
  const displayedRuns = filteredRuns.slice(0, 5);
  const filterCounts = getSmokeArtifactFilterCounts(failedRuns, periodReferenceTime);
  const artifactCount = displayedRuns.filter((run) =>
    Boolean(
      run.artifact_url &&
      getSmokeArtifactExpiryState(run.artifact_expires_at, periodReferenceTime) !== "expired",
    )
  ).length;
  const expiredArtifactCount = displayedRuns.filter((run) =>
    Boolean(
      run.artifact_url &&
      getSmokeArtifactExpiryState(run.artifact_expires_at, periodReferenceTime) === "expired",
    )
  ).length;
  const artifactExpiryCount = displayedRuns.filter((run) =>
    run.artifact_url && getSmokeArtifactExpiryState(run.artifact_expires_at, periodReferenceTime)
  ).length;

  if (!visible) return null;

  const copyFilterLink = async () => {
    const nextShareUrl = window.location.href;
    setShareUrl(nextShareUrl);
    try {
      await navigator.clipboard.writeText(nextShareUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };

  return (
    <span
      className="inline-flex flex-wrap items-center gap-1 rounded-md border border-rose-200 bg-white/70 px-2 py-0.5 dark:border-rose-500/30 dark:bg-slate-950/50"
      data-artifact-count={artifactCount}
      data-artifact-expiry-count={artifactExpiryCount}
      data-artifact-filter={artifactFilter}
      data-expired-artifact-count={expiredArtifactCount}
      data-filtered-run-count={filteredRuns.length}
      data-testid="smoke-failure-run-links"
    >
      <span className="font-semibold">실패 실행</span>
      <select
        aria-label="실패 실행 Artifact 필터"
        className="rounded border border-current/20 bg-white/80 px-1 py-0.5 font-semibold dark:bg-slate-950/70"
        value={artifactFilter}
        onChange={(event) => {
          const nextFilter = event.target.value as SmokeArtifactFilter;
          setArtifactFilter(nextFilter);
          setCopyStatus("idle");
          setShareUrl("");
          replaceArtifactFilterQuery(nextFilter);
          window.localStorage.setItem(ARTIFACT_FILTER_STORAGE_KEY, nextFilter);
        }}
      >
        <option data-count={filterCounts.all} value="all">
          전체 ({filterCounts.all})
        </option>
        <option data-count={filterCounts.available} value="available">
          다운로드 가능 ({filterCounts.available})
        </option>
        <option data-count={filterCounts.expiring_soon} value="expiring_soon">
          만료 임박 ({filterCounts.expiring_soon})
        </option>
        <option data-count={filterCounts.expired} value="expired">
          만료됨 ({filterCounts.expired})
        </option>
      </select>
      <button
        aria-label="Artifact 필터 링크 복사"
        aria-live="polite"
        className="rounded border border-current/20 bg-white/80 px-1.5 py-0.5 font-semibold hover:bg-white dark:bg-slate-950/70 dark:hover:bg-slate-900"
        data-copy-status={copyStatus}
        data-copy-success-duration-ms={ARTIFACT_COPY_SUCCESS_DURATION_MS}
        data-testid="smoke-artifact-filter-copy"
        onClick={copyFilterLink}
        type="button"
      >
        {copyStatus === "copied"
          ? "링크 복사됨"
          : copyStatus === "error" ? "복사 실패" : "링크 복사"}
      </button>
      {copyStatus === "error" ? (
        <label className="inline-flex max-w-full items-center gap-1 font-semibold text-amber-800 dark:text-amber-200">
          직접 복사
          <input
            aria-label="Artifact 필터 공유 URL 직접 복사"
            autoFocus
            className="w-56 max-w-full rounded border border-amber-300 bg-white px-1.5 py-0.5 font-normal text-slate-700 outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-500/50 dark:bg-slate-950 dark:text-slate-200"
            onClick={(event) => event.currentTarget.select()}
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={shareUrl}
          />
        </label>
      ) : null}
      {displayedRuns.map((run, index) => {
        const runLabel = run.run_number ? `#${run.run_number}` : `${index + 1}번`;
        const expiryState = getSmokeArtifactExpiryState(
          run.artifact_expires_at,
          periodReferenceTime,
        );
        const remainingLabel = getSmokeArtifactRemainingLabel(
          run.artifact_expires_at,
          periodReferenceTime,
        );
        return (
          <span
            key={run.run_url}
            className="inline-flex items-center gap-1"
            data-artifact-expires-at={run.artifact_expires_at || undefined}
            data-artifact-state={expiryState || (run.artifact_url ? "available" : "none")}
            data-testid="smoke-failure-run"
          >
            <a
              className="font-semibold text-rose-700 underline underline-offset-2 dark:text-rose-300"
              href={run.run_url}
              target="_blank"
              rel="noreferrer"
              title={getSmokeRunTooltip(run, timezone)}
            >
              {runLabel}
            </a>
            {run.artifact_url && expiryState === "expired" ? (
              <span
                aria-disabled="true"
                className="cursor-not-allowed font-semibold text-slate-500 line-through dark:text-slate-400"
                data-testid="smoke-failure-artifact-expired"
                title="보관 기간이 끝나 실패 화면을 다운로드할 수 없습니다"
              >
                화면 만료
              </span>
            ) : run.artifact_url ? (
              <a
                aria-label={`${runLabel} 실패 화면 Artifact`}
                className="font-semibold text-cyan-700 underline underline-offset-2 dark:text-cyan-300"
                data-testid="smoke-failure-artifact-link"
                href={run.artifact_url}
                target="_blank"
                rel="noreferrer"
                title="GitHub 로그인 후 실패 화면 ZIP 다운로드"
              >
                화면
              </a>
            ) : null}
            {run.artifact_url && run.artifact_expires_at && expiryState ? (
              <span
                className={`rounded ${ARTIFACT_EXPIRY_STYLES[expiryState]}`}
                data-expiry-state={expiryState}
                data-remaining-label={remainingLabel || undefined}
                data-testid="smoke-artifact-expiry"
                title={`Artifact 만료 시각: ${formatDateTime(run.artifact_expires_at, timezone)}`}
              >
                {ARTIFACT_EXPIRY_LABELS[expiryState]}
                {remainingLabel ? ` · ${remainingLabel}` : ""}
                {` · ${formatDateTime(run.artifact_expires_at, timezone)}`}
              </span>
            ) : null}
          </span>
        );
      })}
      {displayedRuns.length === 0 ? <span>조건에 맞는 실행 없음</span> : null}
      {filteredRuns.length > 5 ? <span>외 {filteredRuns.length - 5}건</span> : null}
    </span>
  );
}

export function getSmokeRunTooltip(run: SmokeMonitoringRecentRun, timezone?: string) {
  return [
    run.run_number ? `#${run.run_number}` : "실행",
    STATUS_LABELS[run.status],
    formatDateTime(run.completed_at, timezone),
    run.summary,
  ].filter(Boolean).join(" · ");
}

function isSmokeArtifactFilter(value: string | null): value is SmokeArtifactFilter {
  return value === "all" || value === "available" || value === "expiring_soon" || value === "expired";
}

function replaceArtifactFilterQuery(filter: SmokeArtifactFilter) {
  const url = new URL(window.location.href);
  if (filter === "all") url.searchParams.delete(ARTIFACT_FILTER_QUERY);
  else url.searchParams.set(ARTIFACT_FILTER_QUERY, filter);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) window.history.replaceState(window.history.state, "", nextUrl);
}
