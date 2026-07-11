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
