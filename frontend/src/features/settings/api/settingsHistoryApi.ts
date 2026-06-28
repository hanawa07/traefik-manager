import apiClient from "@/shared/lib/apiClient";

import type {
  SettingsRollbackActionResult,
  SettingsTestHistoryStatus,
} from "./settingsSharedTypes";

export const settingsHistoryApi = {
  getSettingsTestHistory: async (): Promise<SettingsTestHistoryStatus> => {
    const res = await apiClient.get<SettingsTestHistoryStatus>("/settings/test-history");
    return res.data;
  },

  rollbackSettingsChange: async (auditLogId: string): Promise<SettingsRollbackActionResult> => {
    const res = await apiClient.post<SettingsRollbackActionResult>(`/settings/rollback/${auditLogId}`);
    return res.data;
  },
};
