import type {
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
} from "@/features/settings/api/settingsApi";
import type { SECURITY_ALERT_PROVIDER_OPTIONS } from "@/features/settings/lib/settingsDefaults";

export type SecurityAlertProvider = SecurityAlertSettingsInput["provider"];
export type SecurityAlertProviderOption = (typeof SECURITY_ALERT_PROVIDER_OPTIONS)[number];

export type SecurityAlertProviderFieldProps = {
  formValue: SecurityAlertSettingsInput;
  settings?: SecurityAlertSettingsStatus;
  updateForm: (patch: Partial<SecurityAlertSettingsInput>) => void;
};
