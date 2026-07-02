import type { CertificateDiagnosticsSettingsStatus } from "@/features/settings/api/settingsApi";
import {
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";

interface CertificateDiagnosticsSettingsSummaryProps {
  settings?: CertificateDiagnosticsSettingsStatus;
}

export function CertificateDiagnosticsSettingsSummary({
  settings,
}: CertificateDiagnosticsSettingsSummaryProps) {
  return (
    <SettingsSummary>
      <SettingsSummaryRow
        label="자동 재검사 주기"
        value={formatDurationMinutes(settings?.auto_check_interval_minutes ?? 60)}
      />
      <SettingsSummaryRow label="반복 실패 감지 기준" value={`${settings?.repeat_alert_threshold ?? 3}회`} />
      <SettingsSummaryRow
        label="반복 실패 추적 창"
        value={formatDurationMinutes(settings?.repeat_alert_window_minutes ?? 240)}
      />
      <SettingsSummaryRow
        label="반복 실패 알림 쿨다운"
        value={formatDurationMinutes(settings?.repeat_alert_cooldown_minutes ?? 240)}
      />
      <p className="text-xs text-gray-500 pt-1">
        인증서 발급 사전 진단 자동 재검사와 반복 실패 감지 기준을 공통으로 제어합니다.
      </p>
    </SettingsSummary>
  );
}
