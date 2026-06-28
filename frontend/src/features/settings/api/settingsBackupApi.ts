import apiClient from "@/shared/lib/apiClient";

import type {
  BackupImportResult,
  BackupPayload,
  BackupPreviewResult,
  BackupValidateResult,
} from "./settingsBackupTypes";

export const settingsBackupApi = {
  exportBackup: async (): Promise<BackupPayload> => {
    const res = await apiClient.get<BackupPayload>("/backup/export");
    return res.data;
  },

  importBackup: async (
    mode: "merge" | "overwrite",
    data: BackupPayload
  ): Promise<BackupImportResult> => {
    const res = await apiClient.post<BackupImportResult>("/backup/import", { mode, data });
    return res.data;
  },

  validateBackup: async (
    mode: "merge" | "overwrite",
    data: BackupPayload
  ): Promise<BackupValidateResult> => {
    const res = await apiClient.post<BackupValidateResult>("/backup/validate", { mode, data });
    return res.data;
  },

  previewBackup: async (
    mode: "merge" | "overwrite",
    data: BackupPayload
  ): Promise<BackupPreviewResult> => {
    const res = await apiClient.post<BackupPreviewResult>("/backup/preview", { mode, data });
    return res.data;
  },
};
