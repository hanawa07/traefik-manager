import type { SecurityAlertSettingsStatus } from "@/features/settings/api/settingsApi";
import { SettingsSummaryRow } from "@/features/settings/components/SettingsCardPrimitives";
import {
  CHANGE_ALERT_EVENT_OPTIONS,
  SECURITY_ALERT_EVENT_OPTIONS,
} from "@/features/settings/lib/settingsDefaults";
import { getSecurityAlertRouteLabel } from "@/features/settings/lib/settingsFormHelpers";

interface SecurityAlertRoutingSummaryProps {
  settings?: SecurityAlertSettingsStatus;
  providerLabel: string;
}

export function SecurityAlertRoutingSummary({
  settings,
  providerLabel,
}: SecurityAlertRoutingSummaryProps) {
  return (
    <>
      <SettingsSummaryRow
        label="Manager Docker 감지"
        value={settings?.manager_health_monitoring_enabled === false ? "비활성화" : "활성화"}
      />
      <SettingsSummaryRow
        label="Manager 장애 재알림"
        value={
          settings?.manager_health_monitoring_enabled === false &&
          !settings?.manager_http_error_monitoring_enabled
            ? "감지 비활성화"
            : `${settings?.manager_health_alert_cooldown_minutes ?? 60}분 후`
        }
      />
      <SettingsSummaryRow
        label="Manager API 오류 감지"
        value={
          settings?.manager_http_error_monitoring_enabled
            ? `${settings.manager_http_error_window_minutes}분 · 404 ${settings.manager_http_not_found_threshold}건 · 5xx ${settings.manager_http_server_error_threshold}건`
            : "비활성화"
        }
      />
      <SettingsSummaryRow
        label="외부 watchdog 지연 판정"
        value={`${settings?.external_watchdog_stale_minutes ?? 10}분`}
      />
      <SettingsSummaryRow label="전송 이벤트" value={(settings?.alert_events ?? []).join(", ")} />
      {SECURITY_ALERT_EVENT_OPTIONS.map((eventOption) => (
        <SettingsSummaryRow
          key={`summary-${eventOption.key}`}
          label={eventOption.label}
          value={getSecurityAlertRouteLabel(
            settings?.event_routes?.[eventOption.key] ?? "default",
            providerLabel,
          )}
        />
      ))}
      {CHANGE_ALERT_EVENT_OPTIONS.map((eventOption) => (
        <SettingsSummaryRow
          key={`summary-change-${eventOption.key}`}
          label={eventOption.label}
          value={getSecurityAlertRouteLabel(
            settings?.change_event_routes?.[eventOption.key] ?? "default",
            providerLabel,
          )}
        />
      ))}
    </>
  );
}
