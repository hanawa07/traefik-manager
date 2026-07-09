import type { TimeDisplaySettingsStatus } from "@/features/settings/api/settingsApi";

export function TimeDisplayRuntimeSummary({
  settings,
}: {
  settings?: TimeDisplaySettingsStatus;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="flex justify-between gap-4">
        <span className="text-gray-500 dark:text-slate-400">저장 기준</span>
        <span className="font-mono text-gray-700 dark:text-slate-200">{settings?.storage_timezone} (고정)</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-500 dark:text-slate-400">서버 시간대</span>
        <span className="font-mono text-gray-700 dark:text-slate-200">
          {settings?.server_timezone_label} ({settings?.server_timezone_offset})
        </span>
      </div>
      <p className="pt-1 text-xs text-gray-500 dark:text-slate-400">
        저장 데이터와 토큰 시각은 항상 UTC로 유지됩니다. 서버 시간대는 현재 컨테이너의 로컬 시간대로, `docker
        compose`의 `TZ` 설정에 따라 달라질 수 있습니다.
      </p>
    </div>
  );
}
