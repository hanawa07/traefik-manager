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

export interface AuditArchiveItem {
  filename: string;
  size_bytes: number;
  modified_at: string;
}

export interface AuditArchiveListStatus {
  archives: AuditArchiveItem[];
}

export interface AuditArchiveRestoreResult {
  filename: string;
  total_count: number;
  restored_count: number;
  skipped_count: number;
}

export function getAuditArchiveDownloadUrl(filename: string): string {
  const baseUrl = String(apiClient.defaults.baseURL || "/api/v1").replace(/\/$/, "");
  return `${baseUrl}/settings/audit-retention/archives/${encodeURIComponent(filename)}/download`;
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
  getAuditArchives: async (): Promise<AuditArchiveListStatus> => {
    const response = await apiClient.get<AuditArchiveListStatus>(
      "/settings/audit-retention/archives",
    );
    return response.data;
  },
  restoreAuditArchive: async (filename: string): Promise<AuditArchiveRestoreResult> => {
    const response = await apiClient.post<AuditArchiveRestoreResult>(
      `/settings/audit-retention/archives/${encodeURIComponent(filename)}/restore`,
    );
    return response.data;
  },
};
