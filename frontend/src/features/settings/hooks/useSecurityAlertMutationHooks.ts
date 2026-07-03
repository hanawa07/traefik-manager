import {
  type SettingsActionTestResult,
  settingsApi,
} from "../api/settingsApi";
import { settingsQueryKeys } from "./settingsQueryKeys";
import { useSettingsMutationForQuery } from "./useSettingsHookHelpers";

export function useUpdateSecurityAlertSettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateSecurityAlertSettings,
    settingsQueryKeys.securityAlerts,
  );
}

export function useTestSecurityAlertSettings() {
  return useSettingsMutationForQuery<SettingsActionTestResult>(
    settingsApi.testSecurityAlertSettings,
    settingsQueryKeys.testHistory,
  );
}
