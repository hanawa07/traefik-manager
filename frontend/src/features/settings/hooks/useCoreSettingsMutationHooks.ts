import { DEPLOYMENT_INFO_QUERY_KEY } from "@/features/deployment/hooks/useDeploymentInfo";

import { settingsApi } from "../api/settingsApi";
import { settingsQueryKeys } from "./settingsQueryKeys";
import { useSettingsMutationForQuery } from "./useSettingsHookHelpers";
import { useSettingsMutation } from "./useSettingsMutation";

export function useUpdateTimeDisplaySettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateTimeDisplaySettings,
    settingsQueryKeys.timeDisplay,
  );
}

export function useUpdateAuditRetentionSettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateAuditRetentionSettings,
    settingsQueryKeys.auditRetention,
  );
}

export function useRunAuditRetentionCleanup() {
  return useSettingsMutationForQuery(
    settingsApi.runAuditRetentionCleanup,
    settingsQueryKeys.auditRetention,
  );
}

export function useUpdateCertificateDiagnosticsSettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateCertificateDiagnosticsSettings,
    settingsQueryKeys.certificateDiagnostics,
  );
}

export function useUpdateDeploymentBottleneckSettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateDeploymentBottleneckSettings,
    settingsQueryKeys.deploymentBottleneck,
  );
}

export function useCleanupDeploymentBottleneckEvents() {
  return useSettingsMutationForQuery(
    settingsApi.cleanupDeploymentBottleneckEvents,
    DEPLOYMENT_INFO_QUERY_KEY,
  );
}

export function usePreviewDeploymentBottleneckEventCleanup() {
  return useSettingsMutation({
    mutationFn: settingsApi.previewDeploymentBottleneckEventCleanup,
  });
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

export function useUpdateSmokeMonitoringSettings() {
  return useSettingsMutationForQuery(
    settingsApi.updateSmokeMonitoringSettings,
    settingsQueryKeys.smokeRotation,
  );
}

export function useRefreshSmokeMonitoringHistory() {
  return useSettingsMutationForQuery(
    settingsApi.refreshSmokeMonitoringHistory,
    settingsQueryKeys.smokeRotation,
  );
}

export function useTestSmokeAdminStaleAlert() {
  return useSettingsMutation({
    mutationFn: settingsApi.testSmokeAdminStaleAlert,
  });
}
