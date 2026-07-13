import {
  type ManagerHttpErrorPreview,
  type ManagerHttpErrorPreviewInput,
  type SettingsActionTestResult,
  settingsApi,
} from "../api/settingsApi";
import { settingsQueryKeys } from "./settingsQueryKeys";
import { useSettingsMutationForQuery } from "./useSettingsHookHelpers";
import { useSettingsMutation } from "./useSettingsMutation";

export function usePreviewManagerHttpErrors() {
  return useSettingsMutation<ManagerHttpErrorPreview, ManagerHttpErrorPreviewInput>({
    mutationFn: settingsApi.previewManagerHttpErrors,
  });
}

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
