"use client";

import { useState } from "react";

import type { SmokeMonitoringRecentRun } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { SmokeArtifactExpiryLabel } from "./SmokeArtifactExpiryLabel";
import { SmokeArtifactLink } from "./SmokeArtifactLink";

type RunStatusFilter = "all" | SmokeMonitoringRecentRun["status"];

const STATUS_LABELS = {
  success: "성공",
  failure: "실패",
  skipped: "건너뜀",
} as const;

const STATUS_STYLES = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failure: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  skipped: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
} as const;

interface SmokeRecentRunHistoryProps {
  referenceTime: number;
  runs: SmokeMonitoringRecentRun[];
  timezone?: string;
}

export function SmokeRecentRunHistory({
  referenceTime,
  runs,
  timezone,
}: SmokeRecentRunHistoryProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunStatusFilter>("all");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRuns = runs.filter((run) => {
    if (status !== "all" && run.status !== status) return false;
    if (!normalizedSearch) return true;
    return [run.run_number, run.commit_sha, run.summary]
      .filter((value) => value !== null)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });

  return (
    <details
      className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950"
      data-testid="smoke-recent-run-history"
    >
      <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
        최근 GitHub 원격 실행 {runs.length}건
      </summary>
      {runs.length ? (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
            <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
              최근 실행 검색
              <input
                aria-label="최근 원격 실행 검색"
                autoComplete="off"
                className="min-w-0 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                data-testid="smoke-recent-run-search"
                maxLength={100}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="실행 번호·커밋·요약 검색"
                spellCheck={false}
                type="search"
                value={search}
              />
            </label>
            <label className="grid gap-1 text-[11px] text-gray-500 dark:text-slate-400">
              실행 상태
              <select
                aria-label="최근 원격 실행 상태"
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                data-testid="smoke-recent-run-status-filter"
                onChange={(event) => setStatus(event.target.value as RunStatusFilter)}
                value={status}
              >
                <option value="all">전체 ({runs.length})</option>
                <option value="success">성공 ({runs.filter((run) => run.status === "success").length})</option>
                <option value="failure">실패 ({runs.filter((run) => run.status === "failure").length})</option>
                <option value="skipped">건너뜀 ({runs.filter((run) => run.status === "skipped").length})</option>
              </select>
            </label>
            <span
              aria-live="polite"
              className="text-[11px] text-gray-500 dark:text-slate-400"
              data-testid="smoke-recent-run-filter-count"
            >
              {filteredRuns.length}/{runs.length}건
            </span>
          </div>
          {filteredRuns.length ? (
            <ol className="mt-3 space-y-2">
              {filteredRuns.map((run) => (
                <li
                  key={run.run_url}
                  className="rounded-md border border-gray-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
                  data-run-status={run.status}
                  data-testid="smoke-recent-run-item"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[run.status]}`}
                    >
                      {STATUS_LABELS[run.status]}
                    </span>
                    <a
                      className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                      href={run.run_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {run.run_number ? `#${run.run_number}` : "실행 보기"}
                    </a>
                    {run.artifact_url ? (
                      <SmokeArtifactLink
                        artifactUrl={run.artifact_url}
                        expiresAt={run.artifact_expires_at}
                        label="실패 화면"
                        expiredLabel="화면 만료"
                        testId="smoke-recent-run-artifact-link"
                        expiredTestId="smoke-recent-run-artifact-expired"
                        referenceTime={referenceTime}
                      />
                    ) : null}
                    {run.artifact_url && run.artifact_expires_at ? (
                      <SmokeArtifactExpiryLabel
                        expiresAt={run.artifact_expires_at}
                        referenceTime={referenceTime}
                        timezone={timezone}
                      />
                    ) : null}
                    <span className="text-gray-500 dark:text-slate-400">
                      {formatDateTime(run.completed_at, timezone)}
                    </span>
                    {run.commit_sha ? (
                      <code className="text-gray-500 dark:text-slate-400">{run.commit_sha}</code>
                    ) : null}
                  </div>
                  {run.summary ? (
                    <p className="mt-2 text-gray-600 dark:text-slate-300">{run.summary}</p>
                  ) : null}
                  {run.notification_suppressed ? (
                    <p className="mt-2 font-medium text-amber-700 dark:text-amber-300">
                      중복 Telegram 알림 억제
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
              검색 조건에 맞는 원격 실행이 없습니다.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          표시할 원격 실행이 없습니다.
        </p>
      )}
    </details>
  );
}
