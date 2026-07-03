import {
  type BackupImportResult,
  type BackupPayload,
  type BackupPreviewResult,
  type BackupValidateResult,
  settingsApi,
} from "../api/settingsApi";
import { backupImportInvalidationKeys } from "./settingsQueryKeys";
import { useSettingsMutation } from "./useSettingsMutation";

type BackupMutationVariables = {
  mode: "merge" | "overwrite";
  data: BackupPayload;
};

export function useExportBackup() {
  return useSettingsMutation<BackupPayload>({
    mutationFn: () => settingsApi.exportBackup(),
  });
}

export function useImportBackup() {
  return useSettingsMutation<BackupImportResult, BackupMutationVariables>({
    mutationFn: (params) => settingsApi.importBackup(params.mode, params.data),
    invalidateKeys: backupImportInvalidationKeys,
  });
}

export function useValidateBackup() {
  return useSettingsMutation<BackupValidateResult, BackupMutationVariables>({
    mutationFn: (params) => settingsApi.validateBackup(params.mode, params.data),
  });
}

export function usePreviewBackup() {
  return useSettingsMutation<BackupPreviewResult, BackupMutationVariables>({
    mutationFn: (params) => settingsApi.previewBackup(params.mode, params.data),
  });
}
