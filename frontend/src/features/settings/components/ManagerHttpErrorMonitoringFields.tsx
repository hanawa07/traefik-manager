import type { SecurityAlertSettingsInput } from "@/features/settings/api/settingsApi";

interface ManagerHttpErrorMonitoringFieldsProps {
  formValue: SecurityAlertSettingsInput;
  updateForm: (patch: Partial<SecurityAlertSettingsInput>) => void;
}

export function ManagerHttpErrorMonitoringFields({
  formValue,
  updateForm,
}: ManagerHttpErrorMonitoringFieldsProps) {
  const disabled = !formValue.manager_http_error_monitoring_enabled;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700 dark:text-slate-300">
        <input
          checked={formValue.manager_http_error_monitoring_enabled}
          className="mt-0.5 h-4 w-4 rounded accent-amber-600"
          onChange={(event) =>
            updateForm({ manager_http_error_monitoring_enabled: event.target.checked })
          }
          type="checkbox"
        />
        <span>
          <span className="block font-medium text-gray-900 dark:text-slate-100">
            Manager API 오류 임계치 감지
          </span>
          <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
            짧은 구간의 404·5xx 급증과 정상화를 감사 로그에 기록합니다. 알림 전송에는 운영 변경 알림도 활성화되어 있어야 합니다.
          </span>
        </span>
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <NumberField
          disabled={disabled}
          label="집계 구간"
          max={60}
          min={5}
          suffix="분"
          value={formValue.manager_http_error_window_minutes}
          onChange={(value) => updateForm({ manager_http_error_window_minutes: value })}
        />
        <NumberField
          disabled={disabled}
          label="404 임계치"
          max={10000}
          min={1}
          suffix="건"
          value={formValue.manager_http_not_found_threshold}
          onChange={(value) => updateForm({ manager_http_not_found_threshold: value })}
        />
        <NumberField
          disabled={disabled}
          label="5xx 임계치"
          max={10000}
          min={1}
          suffix="건"
          value={formValue.manager_http_server_error_threshold}
          onChange={(value) => updateForm({ manager_http_server_error_threshold: value })}
        />
      </div>
      <label className="mt-3 block text-xs font-medium text-gray-700 dark:text-slate-300">
        임계치 제외 경로
        <textarea
          aria-label="임계치 제외 경로"
          className="mt-1 block min-h-24 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 placeholder:font-sans placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          disabled={disabled}
          maxLength={10049}
          onChange={(event) =>
            updateForm({ manager_http_excluded_paths: event.target.value.split("\n") })
          }
          placeholder={"/api/v1/example\n/api/v1/health"}
          rows={3}
          value={formValue.manager_http_excluded_paths.join("\n")}
        />
        <span className="mt-1 block font-normal text-gray-500 dark:text-slate-400">
          한 줄에 하나씩 입력합니다. 해당 경로와 하위 경로는 임계치 계산에서만 제외됩니다.
        </span>
      </label>
    </div>
  );
}

function NumberField({
  disabled,
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  disabled: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
      {label}
      <span className="mt-1 flex items-center gap-1.5">
        <input
          className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          disabled={disabled}
          max={max}
          min={min}
          onChange={(event) => {
            if (Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber);
          }}
          type="number"
          value={value}
        />
        <span className="font-normal text-gray-500 dark:text-slate-400">{suffix}</span>
      </span>
    </label>
  );
}
