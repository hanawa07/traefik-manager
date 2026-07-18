import type { SecurityAlertSettingsInput } from "@/features/settings/api/settingsApi";

interface SecurityAlertRetryDelayFieldProps {
  value: number;
  onChange: (patch: Partial<SecurityAlertSettingsInput>) => void;
}

export function SecurityAlertRetryDelayField({
  value,
  onChange,
}: SecurityAlertRetryDelayFieldProps) {
  return (
    <label
      className="block rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm font-medium text-gray-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-slate-300"
      data-testid="security-alert-retry-delay-setting"
    >
      자동 재시도 지연 판정 시간
      <span className="mt-1 flex items-center gap-2">
        <input
          aria-label="자동 재시도 지연 판정 시간"
          className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          max={1440}
          min={5}
          onChange={(event) => {
            if (Number.isFinite(event.target.valueAsNumber)) {
              onChange({ automatic_retry_delay_warning_minutes: event.target.valueAsNumber });
            }
          }}
          type="number"
          value={value}
        />
        <span className="text-xs font-normal text-gray-500 dark:text-slate-400">
          분 (5~1440)
        </span>
      </span>
      <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">
        감사 로그에서 자동 재시도 단계가 이 시간을 초과하면 지연으로 강조합니다.
      </span>
    </label>
  );
}
