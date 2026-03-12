import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
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

export function useCloudflareStatus() {
  return useQuery({
    queryKey: ["settings", "cloudflare"],
    queryFn: settingsApi.getCloudflareStatus,
    staleTime: 30_000,
  });
}

export function useTimeDisplaySettings() {
  return useQuery({
    queryKey: ["settings", "time-display"],
    queryFn: settingsApi.getTimeDisplaySettings,
    staleTime: 30_000,
  });
}

export function useCertificateDiagnosticsSettings() {
  return useQuery({
    queryKey: ["settings", "certificate-diagnostics"],
    queryFn: settingsApi.getCertificateDiagnosticsSettings,
    staleTime: 30_000,
  });
}

export function useTraefikDashboardSettings() {
  return useQuery({
    queryKey: ["settings", "traefik-dashboard"],
    queryFn: settingsApi.getTraefikDashboardSettings,
    staleTime: 30_000,
  });
}

export function useUpstreamSecuritySettings() {
  return useQuery({
    queryKey: ["settings", "upstream-security"],
    queryFn: settingsApi.getUpstreamSecuritySettings,
    staleTime: 30_000,
  });
}

export function useLoginDefenseSettings() {
  return useQuery({
    queryKey: ["settings", "login-defense"],
    queryFn: settingsApi.getLoginDefenseSettings,
    staleTime: 30_000,
  });
}

export function useSecurityAlertSettings() {
  return useQuery({
    queryKey: ["settings", "security-alerts"],
    queryFn: settingsApi.getSecurityAlertSettings,
    staleTime: 30_000,
  });
}

export function useSettingsTestHistory() {
  return useQuery({
    queryKey: ["settings", "test-history"],
    queryFn: settingsApi.getSettingsTestHistory,
    staleTime: 10_000,
  });
}

export function useUpdateCloudflareSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CloudflareSettingsInput) => settingsApi.updateCloudflareSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "cloudflare"] });
    },
  });
}

export function useTestCloudflareConnection() {
  const queryClient = useQueryClient();
  return useMutation<SettingsActionTestResult>({
    mutationFn: () => settingsApi.testCloudflareConnection(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "test-history"] });
    },
  });
}

export function useDiagnoseCloudflareDnsDrift() {
  const queryClient = useQueryClient();
  return useMutation<CloudflareDriftCheckResult>({
    mutationFn: () => settingsApi.diagnoseCloudflareDnsDrift(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "test-history"] });
    },
  });
}

export function useReconcileCloudflareDns() {
  const queryClient = useQueryClient();
  return useMutation<SettingsActionTestResult>({
    mutationFn: () => settingsApi.reconcileCloudflareDns(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings", "test-history"] }),
        queryClient.invalidateQueries({ queryKey: ["services"] }),
      ]);
    },
  });
}

export function useUpdateTimeDisplaySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TimeDisplaySettingsInput) => settingsApi.updateTimeDisplaySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "time-display"] });
    },
  });
}

export function useUpdateCertificateDiagnosticsSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CertificateDiagnosticsSettingsInput) =>
      settingsApi.updateCertificateDiagnosticsSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "certificate-diagnostics"] });
    },
  });
}

export function useUpdateTraefikDashboardSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TraefikDashboardSettingsInput) => settingsApi.updateTraefikDashboardSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "traefik-dashboard"] });
    },
  });
}

export function useUpdateUpstreamSecuritySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpstreamSecuritySettingsInput) => settingsApi.updateUpstreamSecuritySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "upstream-security"] });
    },
  });
}

export function useUpdateLoginDefenseSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginDefenseSettingsInput) => settingsApi.updateLoginDefenseSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "login-defense"] });
    },
  });
}

export function useUpdateSecurityAlertSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SecurityAlertSettingsInput) => settingsApi.updateSecurityAlertSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "security-alerts"] });
    },
  });
}

export function useTestSecurityAlertSettings() {
  const queryClient = useQueryClient();
  return useMutation<SettingsActionTestResult>({
    mutationFn: () => settingsApi.testSecurityAlertSettings(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "test-history"] });
    },
  });
}

export function useRollbackSettingsChange() {
  const queryClient = useQueryClient();
  return useMutation<SettingsRollbackActionResult, unknown, string>({
    mutationFn: (auditLogId) => settingsApi.rollbackSettingsChange(auditLogId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "time-display"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "certificate-diagnostics"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "traefik-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "upstream-security"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "login-defense"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "security-alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "cloudflare"] }),
      ]);
    },
  });
}

export function useExportBackup() {
  return useMutation({
    mutationFn: () => settingsApi.exportBackup(),
  });
}

export function useImportBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { mode: "merge" | "overwrite"; data: BackupPayload }) =>
      settingsApi.importBackup(params.mode, params.data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services"] }),
        queryClient.invalidateQueries({ queryKey: ["redirect-hosts"] }),
        queryClient.invalidateQueries({ queryKey: ["traefik-health"] }),
        queryClient.invalidateQueries({ queryKey: ["traefik-router-status"] }),
      ]);
    },
  });
}

export function useValidateBackup() {
  return useMutation<BackupValidateResult, unknown, { mode: "merge" | "overwrite"; data: BackupPayload }>({
    mutationFn: (params) => settingsApi.validateBackup(params.mode, params.data),
  });
}

export function usePreviewBackup() {
  return useMutation<BackupPreviewResult, unknown, { mode: "merge" | "overwrite"; data: BackupPayload }>({
    mutationFn: (params) => settingsApi.previewBackup(params.mode, params.data),
  });
}
