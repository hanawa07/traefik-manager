import type { SecurityAlertSettingsInput } from "@/features/settings/api/settingsApi";

interface ManagerHealthMonitoringFieldsProps {
  formValue: SecurityAlertSettingsInput;
  updateForm: (patch: Partial<SecurityAlertSettingsInput>) => void;
}

export function ManagerHealthMonitoringFields({
  formValue,
  updateForm,
}: ManagerHealthMonitoringFieldsProps) {
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-500/30 dark:bg-sky-500/10">
      <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700 dark:text-slate-300">
        <input
          checked={formValue.manager_health_monitoring_enabled}
          className="mt-0.5 h-4 w-4 rounded accent-sky-600"
          onChange={(event) =>
            updateForm({ manager_health_monitoring_enabled: event.target.checked })
          }
          type="checkbox"
        />
        <span>
          <span className="block font-medium text-gray-900 dark:text-slate-100">
            Manager Docker 상태 감지
          </span>
          <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
            Backend와 Frontend의 이상·복구 전이를 감사 로그에 기록합니다. 알림 전송에는 운영 변경 알림도 활성화되어 있어야 합니다.
          </span>
        </span>
      </label>

      <label className="mt-3 block text-sm font-medium text-gray-700 dark:text-slate-300">
        같은 장애 재알림 대기 시간
        <span className="mt-1 flex items-center gap-2">
          <input
            className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            disabled={!formValue.manager_health_monitoring_enabled}
            max={1440}
            min={5}
            onChange={(event) => {
              if (Number.isFinite(event.target.valueAsNumber)) {
                updateForm({ manager_health_alert_cooldown_minutes: event.target.valueAsNumber });
              }
            }}
            type="number"
            value={formValue.manager_health_alert_cooldown_minutes}
          />
          <span className="text-xs font-normal text-gray-500 dark:text-slate-400">분 (5~1440)</span>
        </span>
      </label>

      <label className="mt-3 block text-sm font-medium text-gray-700 dark:text-slate-300">
        외부 watchdog 지연 판정 시간
        <span className="mt-1 flex items-center gap-2">
          <input
            className="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            max={1440}
            min={5}
            onChange={(event) => {
              if (Number.isFinite(event.target.valueAsNumber)) {
                updateForm({ external_watchdog_stale_minutes: event.target.valueAsNumber });
              }
            }}
            type="number"
            value={formValue.external_watchdog_stale_minutes}
          />
          <span className="text-xs font-normal text-gray-500 dark:text-slate-400">
            분 (5~1440, cron은 5분 간격)
          </span>
        </span>
      </label>
    </div>
  );
}
