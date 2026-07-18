import { settingsApi } from "../api/settingsApi";
import { settingsQueryKeys } from "./settingsQueryKeys";
import {
  TEST_HISTORY_STALE_TIME_MS,
  useSettingsQuery,
} from "./useSettingsHookHelpers";

export function useCloudflareStatus() {
  return useSettingsQuery(settingsQueryKeys.cloudflare, settingsApi.getCloudflareStatus);
}

export function useAuditRetentionSettings() {
  return useSettingsQuery(
    settingsQueryKeys.auditRetention,
    settingsApi.getAuditRetentionSettings,
  );
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

export function useDeploymentBottleneckSettings() {
  return useSettingsQuery(
    settingsQueryKeys.deploymentBottleneck,
    settingsApi.getDeploymentBottleneckSettings,
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

export function useSmokeRotationStatus() {
  return useSettingsQuery(settingsQueryKeys.smokeRotation, settingsApi.getSmokeRotationStatus);
}

export function useSmokeRotationSummary() {
  return useSettingsQuery(
    settingsQueryKeys.smokeRotationSummary,
    settingsApi.getSmokeRotationSummary,
  );
}

export function useSettingsTestHistory() {
  return useSettingsQuery(
    settingsQueryKeys.testHistory,
    settingsApi.getSettingsTestHistory,
    TEST_HISTORY_STALE_TIME_MS,
  );
}
