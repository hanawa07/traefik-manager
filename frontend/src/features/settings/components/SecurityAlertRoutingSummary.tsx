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
