import apiClient from "@/shared/lib/apiClient";

export interface AuditRetentionSettingsInput {
  retention_days: number;
  archive_enabled: boolean;
}

export interface AuditRetentionSettingsStatus extends AuditRetentionSettingsInput {
  last_run_at: string | null;
  last_archived_count: number;
  last_deleted_count: number;
  last_archive_file: string | null;
}

export const auditRetentionSettingsApi = {
  getAuditRetentionSettings: async (): Promise<AuditRetentionSettingsStatus> => {
    const response = await apiClient.get<AuditRetentionSettingsStatus>(
      "/settings/audit-retention",
    );
    return response.data;
  },
  updateAuditRetentionSettings: async (
    input: AuditRetentionSettingsInput,
  ): Promise<AuditRetentionSettingsStatus> => {
    const response = await apiClient.put<AuditRetentionSettingsStatus>(
      "/settings/audit-retention",
      input,
    );
    return response.data;
  },
  runAuditRetentionCleanup: async (): Promise<AuditRetentionSettingsStatus> => {
    const response = await apiClient.post<AuditRetentionSettingsStatus>(
      "/settings/audit-retention/run",
    );
    return response.data;
  },
};
