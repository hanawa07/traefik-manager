import type { CertificateDiagnosticsSettingsInput } from "@/features/settings/api/settingsApi";

export function createDefaultCertificateDiagnosticsForm(): CertificateDiagnosticsSettingsInput {
  return {
    auto_check_interval_minutes: 60,
    repeat_alert_threshold: 3,
    repeat_alert_window_minutes: 240,
    repeat_alert_cooldown_minutes: 240,
  };
}
