import {
  BackupImportResult,
  BackupPayload,
  BackupPreviewResult,
  BackupValidateResult,
  CloudflareDriftCheckResult,
  SettingsRollbackActionResult,
  SettingsActionTestResult,
  settingsApi,
} from "../api/settingsApi";
import {
  backupImportInvalidationKeys,
  settingsQueryKeys,
  settingsRollbackInvalidationKeys,
} from "./settingsQueryKeys";
import {
  TEST_HISTORY_STALE_TIME_MS,
  useSettingsMutationForQuery,
  useSettingsQuery,
} from "./useSettingsHookHelpers";
import { useSettingsMutation } from "./useSettingsMutation";

export function useCloudflareStatus() {
  return useSettingsQuery(settingsQueryKeys.cloudflare, settingsApi.getCloudflareStatus);
}

export function useTimeDisplaySettings() {
  return useSettingsQuery(settingsQueryKeys.timeDisplay, settingsApi.getTimeDisplaySettings);
}

export function useCertificateDiagnosticsSettings() {
  return useSettingsQuery(
    settingsQueryKeys.certificateDiagnostics,
    settingsApi.getCertificateDiagnosticsSettings,
  );
}

export function useTraefikDashboardSettings() {
  return useSettingsQuery(settingsQueryKeys.traefikDashboard, settingsApi.getTraefikDashboardSettings);
}

export function useUpstreamSecuritySettings() {
  return useSettingsQuery(settingsQueryKeys.upstreamSecurity, settingsApi.getUpstreamSecuritySettings);
}

export function useLoginDefenseSettings() {
  return useSettingsQuery(settingsQueryKeys.loginDefense, settingsApi.getLoginDefenseSettings);
}

export function useSecurityAlertSettings() {
  return useSettingsQuery(settingsQueryKeys.securityAlerts, settingsApi.getSecurityAlertSettings);
}

export function useSettingsTestHistory() {
  return useSettingsQuery(
    settingsQueryKeys.testHistory,
    settingsApi.getSettingsTestHistory,
    TEST_HISTORY_STALE_TIME_MS,
  );
}

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

export function useUpdateTimeDisplaySettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateTimeDisplaySettings,
    settingsQueryKeys.timeDisplay,
  );
}

export function useUpdateCertificateDiagnosticsSettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateCertificateDiagnosticsSettings,
    settingsQueryKeys.certificateDiagnostics,
  );
}

export function useUpdateTraefikDashboardSettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateTraefikDashboardSettings,
    settingsQueryKeys.traefikDashboard,
  );
}

export function useUpdateUpstreamSecuritySettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateUpstreamSecuritySettings,
    settingsQueryKeys.upstreamSecurity,
  );
}

export function useUpdateLoginDefenseSettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateLoginDefenseSettings,
    settingsQueryKeys.loginDefense,
  );
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

export function useRollbackSettingsChange() {
  return useSettingsMutation<SettingsRollbackActionResult, string>({
    mutationFn: (auditLogId) => settingsApi.rollbackSettingsChange(auditLogId),
    invalidateKeys: settingsRollbackInvalidationKeys,
  });
}

export function useExportBackup() {
  return useSettingsMutation<BackupPayload>({
    mutationFn: () => settingsApi.exportBackup(),
  });
}

export function useImportBackup() {
  return useSettingsMutation<BackupImportResult, { mode: "merge" | "overwrite"; data: BackupPayload }>({
    mutationFn: (params: { mode: "merge" | "overwrite"; data: BackupPayload }) =>
      settingsApi.importBackup(params.mode, params.data),
    invalidateKeys: backupImportInvalidationKeys,
  });
}

export function useValidateBackup() {
  return useSettingsMutation<BackupValidateResult, { mode: "merge" | "overwrite"; data: BackupPayload }>({
    mutationFn: (params) => settingsApi.validateBackup(params.mode, params.data),
  });
}

export function usePreviewBackup() {
  return useSettingsMutation<BackupPreviewResult, { mode: "merge" | "overwrite"; data: BackupPayload }>({
    mutationFn: (params) => settingsApi.previewBackup(params.mode, params.data),
  });
}
