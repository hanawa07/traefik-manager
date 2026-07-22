import { Save, X } from "lucide-react";

import type { SmokeMonitoringSettingsInput } from "@/features/settings/api/settingsApi";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";

interface SmokeMonitoringSettingsEditFormProps {
  formValue: SmokeMonitoringSettingsInput;
  scheduleTime: string;
  scheduleTimezone: string;
  errorMessage: string;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: (value: SmokeMonitoringSettingsInput) => void;
}

export function SmokeMonitoringSettingsEditForm({
  formValue,
  scheduleTime,
  scheduleTimezone,
  errorMessage,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: SmokeMonitoringSettingsEditFormProps) {
  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-gray-300"
          checked={formValue.monitoring_enabled}
          onChange={(event) =>
            onFormChange({ ...formValue, monitoring_enabled: event.target.checked })
          }
        />
        <span>
          <span className="block text-sm font-medium text-gray-800 dark:text-slate-200">예약 자동 점검 사용</span>
          <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
            중지해도 관리자가 시작한 수동 점검과 월간 비밀번호 회전 후 검증은 계속 실행됩니다.
          </span>
        </span>
      </label>

      <div>
        <label className="label" htmlFor="smoke-monitoring-frequency">예약 주기</label>
        <select
          id="smoke-monitoring-frequency"
          className="input"
          value={formValue.monitoring_frequency}
          disabled={!formValue.monitoring_enabled}
          onChange={(event) =>
            onFormChange({
              ...formValue,
              monitoring_frequency: event.target.value as SmokeMonitoringSettingsInput["monitoring_frequency"],
            })
          }
        >
          <option value="daily">매일</option>
          <option value="weekly">매주 일요일</option>
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          GitHub Actions가 {scheduleTime} ({scheduleTimezone})에 설정을 확인하고 실행합니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="smoke-failure-rate-window">
            실패율 판정 기간
          </label>
          <select
            id="smoke-failure-rate-window"
            className="input"
            value={formValue.monitoring_failure_rate_window_days}
            onChange={(event) =>
              onFormChange({
                ...formValue,
                monitoring_failure_rate_window_days: Number(event.target.value) as 7 | 30,
              })
            }
          >
            <option value={7}>최근 7일</option>
            <option value={30}>최근 30일</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="smoke-failure-rate-threshold">
            실패율 경고 기준 (%)
          </label>
          <input
            id="smoke-failure-rate-threshold"
            className="input"
            type="number"
            min={1}
            max={100}
            value={formValue.monitoring_failure_rate_threshold_percent}
            onChange={(event) =>
              onFormChange({
                ...formValue,
                monitoring_failure_rate_threshold_percent: Number(event.target.value),
              })
            }
          />
        </div>
        <div>
          <label className="label" htmlFor="smoke-failure-rate-min-runs">
            판정 최소 표본 (회)
          </label>
          <input
            id="smoke-failure-rate-min-runs"
            className="input"
            type="number"
            min={1}
            max={30}
            value={formValue.monitoring_failure_rate_min_runs}
            onChange={(event) =>
              onFormChange({
                ...formValue,
                monitoring_failure_rate_min_runs: Number(event.target.value),
              })
            }
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400">
        최근 {formValue.monitoring_failure_rate_window_days}일의 완료된 점검이 최소 표본 이상이고
        실패율이 기준 이상이면 대시보드에 경고합니다.
      </p>

      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/30">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
            checked={formValue.monitoring_github_rate_limit_alert_enabled}
            onChange={(event) =>
              onFormChange({
                ...formValue,
                monitoring_github_rate_limit_alert_enabled: event.target.checked,
              })
            }
          />
          <span>
            <span className="block text-sm font-medium text-gray-800 dark:text-slate-200">
              GitHub API 반복 제한 운영 알림
            </span>
            <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
              기준 횟수에 도달하면 경고를 기록하고, 운영 변경 알림이 켜져 있으면 해당 경로로 전송합니다.
            </span>
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="smoke-github-alert-window">
              판정 기간 (시간)
            </label>
            <input
              id="smoke-github-alert-window"
              className="input"
              type="number"
              min={1}
              max={168}
              disabled={!formValue.monitoring_github_rate_limit_alert_enabled}
              value={formValue.monitoring_github_rate_limit_alert_window_hours}
              onChange={(event) =>
                onFormChange({
                  ...formValue,
                  monitoring_github_rate_limit_alert_window_hours: Number(event.target.value),
                })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="smoke-github-primary-alert-threshold">
              기본 한도 기준 (회)
            </label>
            <input
              id="smoke-github-primary-alert-threshold"
              className="input"
              type="number"
              min={1}
              max={100}
              disabled={!formValue.monitoring_github_rate_limit_alert_enabled}
              value={formValue.monitoring_github_primary_limit_alert_threshold}
              onChange={(event) =>
                onFormChange({
                  ...formValue,
                  monitoring_github_primary_limit_alert_threshold: Number(event.target.value),
                })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="smoke-github-secondary-alert-threshold">
              보조 제한 기준 (회)
            </label>
            <input
              id="smoke-github-secondary-alert-threshold"
              className="input"
              type="number"
              min={1}
              max={100}
              disabled={!formValue.monitoring_github_rate_limit_alert_enabled}
              value={formValue.monitoring_github_secondary_limit_alert_threshold}
              onChange={(event) =>
                onFormChange({
                  ...formValue,
                  monitoring_github_secondary_limit_alert_threshold: Number(event.target.value),
                })
              }
            />
          </div>
        </div>
      </div>

      {errorMessage ? <p className="text-xs text-red-600 dark:text-red-300">{errorMessage}</p> : null}

      <SettingsActionRow>
        <button
          type="button"
          className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
          onClick={onSave}
          disabled={isSaving}
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5" /> 취소
        </button>
      </SettingsActionRow>
    </div>
  );
}
