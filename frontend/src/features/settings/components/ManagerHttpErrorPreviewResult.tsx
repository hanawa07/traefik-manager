import type { ManagerHttpErrorPreview } from "@/features/settings/api/settingsApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface ManagerHttpErrorPreviewResultProps {
  currentNotFoundThreshold: number;
  currentServerErrorThreshold: number;
  onApply: () => void;
  preview: ManagerHttpErrorPreview;
}

export function ManagerHttpErrorPreviewResult({
  currentNotFoundThreshold,
  currentServerErrorThreshold,
  onApply,
  preview,
}: ManagerHttpErrorPreviewResultProps) {
  if (!preview.available) {
    return (
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-100" role="status">
        {preview.message}
      </p>
    );
  }
  const coverage = getSampleCoverage(preview);

  return (
    <div
      className="mt-3 rounded-lg border border-amber-200 bg-white/80 p-3 text-xs text-gray-700 dark:border-amber-500/30 dark:bg-slate-950/70 dark:text-slate-300"
      data-recommended-not-found={preview.recommended_not_found_threshold}
      data-recommended-server-error={preview.recommended_server_error_threshold}
      data-testid="manager-http-error-preview"
    >
      <p className="font-semibold text-gray-900 dark:text-slate-100">최대 24시간 권장값</p>
      <p className="mt-1 text-gray-500 dark:text-slate-400">
        로그 관측 시작: {formatDateTime(preview.observed_since)}
      </p>
      <div
        className="mt-2"
        data-sample-coverage={coverage.percent}
        data-testid="manager-http-sample-coverage"
      >
        <div className="flex items-center justify-between gap-3 text-gray-500 dark:text-slate-400">
          <span>표본 충족률</span>
          <span>
            {coverage.percent}% ({coverage.duration} / {preview.window_hours}시간)
          </span>
        </div>
        <div
          aria-label="Manager API 로그 표본 충족률"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={coverage.percent}
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-500/20"
          role="progressbar"
        >
          <div className="h-full rounded-full bg-amber-500" style={{ width: `${coverage.percent}%` }} />
        </div>
      </div>
      <p
        className={`mt-2 rounded-md px-2.5 py-2 font-medium ${
          coverage.complete
            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
            : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100"
        }`}
        data-sample-complete={coverage.complete ? "true" : "false"}
        data-testid="manager-http-sample-guidance"
      >
        {coverage.complete
          ? "24시간 표본이 충족됐습니다. 현재 권장값을 재검토하고 적용하세요."
          : "아직 초기 표본입니다. 24시간 충족 후 권장값을 다시 계산하세요."}
      </p>
      <p className="mt-1">
        최고 {preview.window_minutes}분 구간: 404 {preview.peak_not_found_count}건 · 5xx{" "}
        {preview.peak_server_error_count}건
      </p>
      <p className="mt-1 font-medium text-amber-800 dark:text-amber-100">
        권장 임계치: 404 {preview.recommended_not_found_threshold}건 · 5xx{" "}
        {preview.recommended_server_error_threshold}건
      </p>
      {coverage.complete ? (
        <p
          className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          data-current-not-found={currentNotFoundThreshold}
          data-current-server-error={currentServerErrorThreshold}
          data-testid="manager-http-threshold-comparison"
        >
          현재 설정 대비: 404 {currentNotFoundThreshold}건 →{" "}
          {preview.recommended_not_found_threshold}건 (
          {formatThresholdDelta(currentNotFoundThreshold, preview.recommended_not_found_threshold)}) · 5xx{" "}
          {currentServerErrorThreshold}건 → {preview.recommended_server_error_threshold}건 (
          {formatThresholdDelta(currentServerErrorThreshold, preview.recommended_server_error_threshold)})
        </p>
      ) : null}
      <p className="mt-1 text-gray-500 dark:text-slate-400">
        최고치에 20% 여유를 두고 기존 기본값보다 낮지 않게 계산합니다.
      </p>
      {preview.excluded_paths.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-amber-100 pt-2 dark:border-amber-500/20">
          <p className="font-medium text-gray-900 dark:text-slate-100">제외 경로별 오류</p>
          {preview.excluded_paths.map((item) => (
            <p className="break-all" key={item.path}>
              <code>{item.path}</code> · 404 {item.not_found_count}건 · 5xx{" "}
              {item.server_error_count}건 · 최근 오류:{" "}
              {item.last_seen_at ? formatDateTime(item.last_seen_at) : "없음"}
            </p>
          ))}
        </div>
      ) : null}
      <button
        className="mt-3 rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700"
        onClick={onApply}
        type="button"
      >
        권장값 적용
      </button>
    </div>
  );
}

function formatThresholdDelta(current: number, recommended: number) {
  const delta = recommended - current;
  if (delta === 0) return "변경 없음";
  return `${Math.abs(delta)}건 ${delta > 0 ? "상향" : "하향"}`;
}

function getSampleCoverage(preview: ManagerHttpErrorPreview) {
  const targetMinutes = preview.window_hours * 60;
  const checkedAt = Date.parse(preview.checked_at);
  const observedSince = preview.observed_since ? Date.parse(preview.observed_since) : Number.NaN;
  const elapsedMinutes =
    Number.isFinite(checkedAt) && Number.isFinite(observedSince)
      ? Math.floor((checkedAt - observedSince) / 60_000)
      : 0;
  const coveredMinutes = Math.max(0, Math.min(targetMinutes, elapsedMinutes));
  const hours = Math.floor(coveredMinutes / 60);
  const minutes = coveredMinutes % 60;
  return {
    complete: preview.sample_coverage_percent === 100,
    duration: hours > 0 ? `${hours}시간${minutes > 0 ? ` ${minutes}분` : ""}` : `${minutes}분`,
    percent: Math.max(0, Math.min(100, preview.sample_coverage_percent)),
  };
}
