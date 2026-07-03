import type { TimeDisplaySettingsStatus } from "@/features/settings/api/settingsApi";
import {
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";

export function TimeDisplaySettingsSummary({
  settings,
}: {
  settings?: TimeDisplaySettingsStatus;
}) {
  return (
    <SettingsSummary>
      <SettingsSummaryRow label="현재 표시 시간대" value={settings?.display_timezone || "(미설정)"} mono />
      <SettingsSummaryRow label="저장 기준" value={`${settings?.storage_timezone} (고정)`} mono />
      <SettingsSummaryRow
        label="서버 시간대"
        value={`${settings?.server_timezone_label} (${settings?.server_timezone_offset})`}
        mono
      />
      <p className="pt-1 text-xs text-gray-500">
        저장 데이터와 토큰 시각은 항상 UTC로 유지됩니다. 서버 시간대는 현재 컨테이너의 로컬 시간대로,
        `docker compose`의 `TZ` 설정에 따라 달라질 수 있습니다.
      </p>
    </SettingsSummary>
  );
}
