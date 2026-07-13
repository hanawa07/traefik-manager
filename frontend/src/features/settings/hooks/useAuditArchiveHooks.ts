import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { settingsApi } from "../api/settingsApi";
import { settingsQueryKeys } from "./settingsQueryKeys";

export function useAuditArchives(enabled: boolean) {
  return useQuery({
    queryKey: settingsQueryKeys.auditArchives,
    queryFn: settingsApi.getAuditArchives,
    enabled,
  });
}

export function useRestoreAuditArchive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.restoreAuditArchive,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsQueryKeys.auditArchives }),
        queryClient.invalidateQueries({ queryKey: settingsQueryKeys.auditLogs }),
      ]);
    },
  });
}
