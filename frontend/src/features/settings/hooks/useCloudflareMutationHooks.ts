import {
  type CloudflareDriftCheckResult,
  type SettingsActionTestResult,
  settingsApi,
} from "../api/settingsApi";
import { settingsQueryKeys } from "./settingsQueryKeys";
import { useSettingsMutationForQuery } from "./useSettingsHookHelpers";
import { useSettingsMutation } from "./useSettingsMutation";

export function useUpdateCloudflareSettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateCloudflareSettings,
    settingsQueryKeys.cloudflare,
  );
}

export function useTestCloudflareConnection() {
  return useSettingsMutationForQuery<SettingsActionTestResult>(
    settingsApi.testCloudflareConnection,
    settingsQueryKeys.testHistory,
  );
}

export function useDiagnoseCloudflareDnsDrift() {
  return useSettingsMutationForQuery<CloudflareDriftCheckResult>(
    settingsApi.diagnoseCloudflareDnsDrift,
    settingsQueryKeys.testHistory,
  );
}

export function useReconcileCloudflareDns() {
  return useSettingsMutation<SettingsActionTestResult>({
    mutationFn: () => settingsApi.reconcileCloudflareDns(),
    invalidateKeys: [settingsQueryKeys.testHistory, settingsQueryKeys.services],
  });
}
