import {
  type BackupImportResult,
  type BackupPayload,
  type BackupPreviewResult,
  type BackupValidateResult,
  type CloudflareDriftCheckResult,
  type SettingsActionTestResult,
  type SettingsRollbackActionResult,
  settingsApi,
} from "../api/settingsApi";
import {
  backupImportInvalidationKeys,
  settingsQueryKeys,
  settingsRollbackInvalidationKeys,
} from "./settingsQueryKeys";
import { useSettingsMutationForQuery } from "./useSettingsHookHelpers";
import { useSettingsMutation } from "./useSettingsMutation";

type BackupMutationVariables = {
  mode: "merge" | "overwrite";
  data: BackupPayload;
};

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
  return useSettingsMutation<BackupImportResult, BackupMutationVariables>({
    mutationFn: (params) => settingsApi.importBackup(params.mode, params.data),
    invalidateKeys: backupImportInvalidationKeys,
  });
}

export function useValidateBackup() {
  return useSettingsMutation<BackupValidateResult, BackupMutationVariables>({
    mutationFn: (params) => settingsApi.validateBackup(params.mode, params.data),
  });
}

export function usePreviewBackup() {
  return useSettingsMutation<BackupPreviewResult, BackupMutationVariables>({
    mutationFn: (params) => settingsApi.previewBackup(params.mode, params.data),
  });
}
