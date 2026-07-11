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
