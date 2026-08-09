import type {
  SmokeRotationState,
  SmokeRotationStatus,
} from "@/features/settings/api/settingsApi";
import { SettingsSummaryRow } from "@/features/settings/components/SettingsCardPrimitives";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

const STATUS_LABELS: Record<SmokeRotationState, string> = {
  never: "실행 기록 없음",
  running: "진행 중",
  success: "정상",
  failure: "실패",
};

const STATUS_STYLES: Record<SmokeRotationState, string> = {
  never: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  running: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failure: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

interface SmokeAccountRotationSummaryProps {
  status: SmokeRotationStatus;
  timezone?: string;
}

export function SmokeAccountRotationSummary({
  status,
  timezone,
}: SmokeAccountRotationSummaryProps) {
  const isStaleSuccess = status.status === "success" && status.is_stale;
  const recentLogLines = status.recent_log_lines ?? [];
  const secretRetryCount =
    status.detail?.match(/GitHub secret 갱신 실패: .+ \(시도 (\d+\/\d+)\)$/)?.[1];
  const hostRunTotal = status.monitoring_host_run_total ?? 0;
  const hostRunLimit = status.monitoring_host_run_limit ?? 20;
  const hostRunRetentionDays = status.monitoring_host_run_retention_days ?? 365;

  return (
    <section
      aria-labelledby="smoke-account-rotation-heading"
      className="space-y-2 border-t border-gray-200 pt-4 dark:border-slate-700"
    >
      <h3
        id="smoke-account-rotation-heading"
        className="text-sm font-semibold text-gray-800 dark:text-slate-100"
      >
        계정 회전 상태
      </h3>
      <SettingsSummaryRow
        label="점검 계정 비밀번호"
        value={
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
              isStaleSuccess
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : STATUS_STYLES[status.status]
            }`}
          >
            {isStaleSuccess ? "회전 점검 필요" : STATUS_LABELS[status.status]}
          </span>
        }
      />
      <SettingsSummaryRow
        label="최근 회전 시도"
        value={formatDateTime(status.last_attempt_at, timezone)}
      />
      <SettingsSummaryRow
        label="최근 회전 성공"
        value={formatDateTime(status.last_success_at, timezone)}
      />
      {status.monitoring_mode === "local" ? (
        <>
          <SettingsSummaryRow
            label="최근 로컬 점검 커밋"
            value={status.last_revision ? <code>{status.last_revision.slice(0, 12)}</code> : "기록 없음"}
          />
          <SettingsSummaryRow
            label="로컬 점검 실행 이력"
            value={`${hostRunTotal}건 · ${hostRunRetentionDays}일 보관 · 최근 ${Math.min(hostRunTotal, hostRunLimit)}건 표시`}
          />
        </>
      ) : null}
      <SettingsSummaryRow label="계정 회전 주기" value="매월 1일 04:17" />
      <SettingsSummaryRow
        label="회전 실패 단계"
        value={
          status.status === "failure" ? (
            <code
              className="break-all text-rose-700 dark:text-rose-300"
              data-testid="smoke-rotation-failure-step"
            >
              {status.detail || "알 수 없는 단계"}
            </code>
          ) : (
            "없음"
          )
        }
      />
      <SettingsSummaryRow
        label="Secret 재시도 횟수"
        value={status.status === "failure" ? secretRetryCount || "해당 없음" : "없음"}
      />
      {status.status === "running" && status.detail ? (
        <SettingsSummaryRow label="회전 진행 상태" value={status.detail} />
      ) : null}
      {status.is_stale ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          마지막 성공 후 {status.stale_after_days}일이 지났습니다. cron 실행 로그와 Tailnet
          로컬 점검 경로를 확인하세요.
        </div>
      ) : null}
      <details className="mt-3 border-t border-gray-200 pt-3 dark:border-slate-700">
        <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
          최근 계정 회전 cron 로그 · {formatDateTime(status.log_updated_at, timezone)}
        </summary>
        {recentLogLines.length ? (
          <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-600 dark:text-slate-300">
            {recentLogLines.join("\n")}
          </pre>
        ) : (
          <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
            표시할 cron 로그가 없습니다.
          </p>
        )}
      </details>
    </section>
  );
}
