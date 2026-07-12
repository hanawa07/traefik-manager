import { MonitorCheck } from "lucide-react";

import type {
  SmokeMonitoringSettingsInput,
  SmokeRotationState,
  SmokeRotationStatus,
} from "@/features/settings/api/settingsApi";
import {
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { SmokeMonitoringSettingsEditForm } from "./SmokeMonitoringSettingsEditForm";

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

const RUN_STATUS_LABELS = {
  success: "성공",
  failure: "실패",
  skipped: "건너뜀",
} as const;

const RUN_STATUS_STYLES = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failure: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  skipped: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
} as const;

interface SmokeRotationStatusCardProps {
  canManage: boolean;
  isLoading: boolean;
  isError: boolean;
  isEditing: boolean;
  status?: SmokeRotationStatus;
  timezone?: string;
  formValue: SmokeMonitoringSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: (value: SmokeMonitoringSettingsInput) => void;
}

export function SmokeRotationStatusCard({
  canManage,
  isLoading,
  isError,
  isEditing,
  status,
  timezone,
  formValue,
  errorMessage,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onFormChange,
}: SmokeRotationStatusCardProps) {
  const isStaleSuccess = status?.status === "success" && status.is_stale;
  const recentLogLines = status?.recent_log_lines ?? [];
  const monitoringEnabled = status?.monitoring_enabled ?? true;
  const monitoringFrequency = status?.monitoring_frequency ?? "daily";
  const scheduleTime = status?.monitoring_schedule_time ?? "03:17";
  const scheduleTimezone = status?.monitoring_schedule_timezone ?? "Asia/Seoul";
  const recentRuns = status?.monitoring_recent_runs ?? [];
  const latestFailure = recentRuns.find((run) => run.status === "failure");
  const suppressedRuns = recentRuns.filter((run) => run.notification_suppressed);
  const latestSuppressed = suppressedRuns[0];

  return (
    <div className="card order-6 p-6" data-testid="smoke-rotation-status-card">
      <SettingsCardHeader
        icon={<MonitorCheck className="h-5 w-5 text-cyan-600" />}
        title="운영 로그인·화면 점검"
        description="정상 사용자 로그인과 주요 화면 로딩을 확인하는 운영 점검입니다. 공격 탐지나 취약점 검사는 로그인 보안 방어와 별개입니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isError || !status ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">운영 점검 상태를 불러오지 못했습니다.</p>
      ) : isEditing ? (
        <SmokeMonitoringSettingsEditForm
          formValue={formValue}
          scheduleTime={scheduleTime}
          scheduleTimezone={scheduleTimezone}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={onCancel}
          onFormChange={onFormChange}
        />
      ) : (
        <SettingsSummary>
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200">
            이 점검은 전용 viewer 계정으로 로그인·API·화면이 정상인지 확인합니다. 비밀번호 공격이나 침입 징후는 별도 로그인 보안 방어 설정에서 처리합니다.
          </div>
          <SettingsSummaryRow
            label="예약 자동 점검"
            value={monitoringEnabled ? "사용" : "중지"}
          />
          <SettingsSummaryRow
            label="점검 주기"
            value={monitoringFrequency === "daily" ? "매일" : "매주 일요일"}
          />
          <SettingsSummaryRow label="점검 시각" value={`${scheduleTime} (${scheduleTimezone})`} />
          <SettingsSummaryRow
            label="최근 원격 점검 성공"
            value={
              status.monitoring_last_run_url ? (
                <a
                  className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                  href={status.monitoring_last_run_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {formatDateTime(status.monitoring_last_success_at, timezone)}
                </a>
              ) : (
                "기록 없음"
              )
            }
          />
          <SettingsSummaryRow
            label="최근 원격 점검 실패"
            value={
              latestFailure ? (
                <a
                  className="text-rose-700 underline-offset-2 hover:underline dark:text-rose-300"
                  href={latestFailure.run_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {formatDateTime(latestFailure.completed_at, timezone)}
                </a>
              ) : status.monitoring_history_error ? (
                "확인 불가"
              ) : (
                "최근 5회 없음"
              )
            }
          />
          {latestFailure?.summary ? (
            <SettingsSummaryRow label="최근 실패 요약" value={latestFailure.summary} />
          ) : null}
          <SettingsSummaryRow
            label="반복 실패 알림 억제"
            value={
              status.monitoring_history_error && recentRuns.length === 0
                ? "확인 불가"
                : suppressedRuns.length > 0 && latestSuppressed
                  ? `최근 ${recentRuns.length}회 중 ${suppressedRuns.length}회 · 마지막 ${formatDateTime(latestSuppressed.completed_at, timezone)}`
                  : recentRuns.length > 0
                    ? `최근 ${recentRuns.length}회 중 없음`
                    : "최근 실행 없음"
            }
          />
          <SettingsSummaryRow
            label="수동 점검"
            value={
              <a
                className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                href={status.monitoring_workflow_url}
                target="_blank"
                rel="noreferrer"
              >
                GitHub Actions에서 실행
              </a>
            }
          />
          {status.monitoring_history_error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              {status.monitoring_history_error}. 저장된 최근 성공 기록은 그대로 표시됩니다.
            </div>
          ) : null}
          <details className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
              최근 GitHub 원격 실행 {recentRuns.length}건
            </summary>
            {recentRuns.length ? (
              <ol className="mt-3 space-y-2">
                {recentRuns.map((run) => (
                  <li
                    key={run.run_url}
                    className="rounded-md border border-gray-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${RUN_STATUS_STYLES[run.status]}`}
                      >
                        {RUN_STATUS_LABELS[run.status]}
                      </span>
                      <a
                        className="font-medium text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                        href={run.run_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {run.run_number ? `#${run.run_number}` : "실행 보기"}
                      </a>
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
              <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">표시할 원격 실행이 없습니다.</p>
            )}
          </details>

          <div className="my-3 border-t border-gray-200 dark:border-slate-700" />
          <SettingsSummaryRow
            label="점검 계정 비밀번호"
            value={
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isStaleSuccess ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : STATUS_STYLES[status.status]}`}>
                {isStaleSuccess ? "회전 점검 필요" : STATUS_LABELS[status.status]}
              </span>
            }
          />
          <SettingsSummaryRow label="최근 회전 시도" value={formatDateTime(status.last_attempt_at, timezone)} />
          <SettingsSummaryRow label="최근 회전 성공" value={formatDateTime(status.last_success_at, timezone)} />
          <SettingsSummaryRow label="계정 회전 주기" value="매월 1일 04:17" />
          {status.detail ? <SettingsSummaryRow label="회전 세부 상태" value={status.detail} /> : null}
          {status.is_stale ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              마지막 성공 후 {status.stale_after_days}일이 지났습니다. cron 실행 로그와 GitHub secret 동기화를 확인하세요.
            </div>
          ) : null}
          <details className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200">
              최근 계정 회전 cron 로그 · {formatDateTime(status.log_updated_at, timezone)}
            </summary>
            {recentLogLines.length ? (
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-600 dark:text-slate-300">
                {recentLogLines.join("\n")}
              </pre>
            ) : (
              <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">표시할 cron 로그가 없습니다.</p>
            )}
          </details>
        </SettingsSummary>
      )}
    </div>
  );
}
