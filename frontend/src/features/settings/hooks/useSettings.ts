import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { BackupPayload, settingsApi } from "../api/settingsApi";

export function useCloudflareStatus() {
  return useQuery({
    queryKey: ["settings", "cloudflare"],
    queryFn: settingsApi.getCloudflareStatus,
    staleTime: 30_000,
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
