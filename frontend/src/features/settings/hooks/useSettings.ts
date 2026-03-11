import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  BackupPayload,
  CloudflareSettingsInput,
  LoginDefenseSettingsInput,
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

export function useUpdateCloudflareSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CloudflareSettingsInput) => settingsApi.updateCloudflareSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "cloudflare"] });
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
