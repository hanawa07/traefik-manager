import { useQuery, type QueryKey } from "@tanstack/react-query";

import {
  BackupImportResult,
  BackupPayload,
  BackupPreviewResult,
  BackupValidateResult,
  CertificateDiagnosticsSettingsInput,
  CloudflareDriftCheckResult,
  CloudflareSettingsInput,
  LoginDefenseSettingsInput,
  SettingsRollbackActionResult,
  SecurityAlertSettingsInput,
  SettingsActionTestResult,
  TraefikDashboardSettingsInput,
  TimeDisplaySettingsInput,
  UpstreamSecuritySettingsInput,
  settingsApi,
} from "../api/settingsApi";
import {
  backupImportInvalidationKeys,
  settingsQueryKeys,
  settingsRollbackInvalidationKeys,
} from "./settingsQueryKeys";
import { useSettingsMutation } from "./useSettingsMutation";

const SETTINGS_STALE_TIME_MS = 30_000;
const TEST_HISTORY_STALE_TIME_MS = 10_000;

function useSettingsQuery<TData>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  staleTime = SETTINGS_STALE_TIME_MS,
) {
  return useQuery<TData>({
    queryKey,
    queryFn,
    staleTime,
  });
}

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
  return useSettingsMutation({
    mutationFn: (data: CloudflareSettingsInput) => settingsApi.updateCloudflareSettings(data),
    invalidateKeys: [settingsQueryKeys.cloudflare],
  });
}

export function useTestCloudflareConnection() {
  return useSettingsMutation<SettingsActionTestResult>({
    mutationFn: () => settingsApi.testCloudflareConnection(),
    invalidateKeys: [settingsQueryKeys.testHistory],
  });
}

export function useDiagnoseCloudflareDnsDrift() {
  return useSettingsMutation<CloudflareDriftCheckResult>({
    mutationFn: () => settingsApi.diagnoseCloudflareDnsDrift(),
    invalidateKeys: [settingsQueryKeys.testHistory],
  });
}

export function useReconcileCloudflareDns() {
  return useSettingsMutation<SettingsActionTestResult>({
    mutationFn: () => settingsApi.reconcileCloudflareDns(),
    invalidateKeys: [settingsQueryKeys.testHistory, settingsQueryKeys.services],
  });
}

export function useUpdateTimeDisplaySettings() {
  return useSettingsMutation({
    mutationFn: (data: TimeDisplaySettingsInput) => settingsApi.updateTimeDisplaySettings(data),
    invalidateKeys: [settingsQueryKeys.timeDisplay],
  });
}

export function useUpdateCertificateDiagnosticsSettings() {
  return useSettingsMutation({
    mutationFn: (data: CertificateDiagnosticsSettingsInput) =>
      settingsApi.updateCertificateDiagnosticsSettings(data),
    invalidateKeys: [settingsQueryKeys.certificateDiagnostics],
  });
}

export function useUpdateTraefikDashboardSettings() {
  return useSettingsMutation({
    mutationFn: (data: TraefikDashboardSettingsInput) => settingsApi.updateTraefikDashboardSettings(data),
    invalidateKeys: [settingsQueryKeys.traefikDashboard],
  });
}

export function useUpdateUpstreamSecuritySettings() {
  return useSettingsMutation({
    mutationFn: (data: UpstreamSecuritySettingsInput) => settingsApi.updateUpstreamSecuritySettings(data),
    invalidateKeys: [settingsQueryKeys.upstreamSecurity],
  });
}

export function useUpdateLoginDefenseSettings() {
  return useSettingsMutation({
    mutationFn: (data: LoginDefenseSettingsInput) => settingsApi.updateLoginDefenseSettings(data),
    invalidateKeys: [settingsQueryKeys.loginDefense],
  });
}

export function useUpdateSecurityAlertSettings() {
  return useSettingsMutation({
    mutationFn: (data: SecurityAlertSettingsInput) => settingsApi.updateSecurityAlertSettings(data),
    invalidateKeys: [settingsQueryKeys.securityAlerts],
  });
}

export function useTestSecurityAlertSettings() {
  return useSettingsMutation<SettingsActionTestResult>({
    mutationFn: () => settingsApi.testSecurityAlertSettings(),
    invalidateKeys: [settingsQueryKeys.testHistory],
  });
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
