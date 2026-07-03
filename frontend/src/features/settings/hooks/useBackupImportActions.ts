import { getApiErrorDetail } from "@/features/settings/lib/settingsErrors";
import {
  useImportBackup,
  usePreviewBackup,
  useValidateBackup,
} from "@/features/settings/hooks/useSettings";
import {
  formatBackupImportResult,
  readBackupPayloadFile,
} from "./backupImportActionHelpers";
import { useBackupImportState } from "./useBackupImportState";

export function useBackupImportActions(canManage: boolean) {
  const importState = useBackupImportState();
  const importBackup = useImportBackup();
  const validateBackup = useValidateBackup();
  const previewBackup = usePreviewBackup();

  const readBackupPayload = async () => {
    if (!importState.backupFile) return null;

    const result = await readBackupPayloadFile(importState.backupFile);
    if (!result.ok) {
      importState.setImportResultMessage(result.errorMessage);
      return null;
    }

    return result.data;
  };

  const handleImport = async () => {
    if (!canManage || !importState.backupFile) return;
    importState.setImportResultMessage("");
    importState.resetReview();

    const data = await readBackupPayload();
    if (!data) return;

    try {
      const result = await importBackup.mutateAsync({ mode: importState.importMode, data });
      importState.setImportResultMessage(formatBackupImportResult(result));
      importState.setBackupFile(null);
    } catch {
      return;
    }
  };

  const handleValidate = async () => {
    if (!importState.backupFile) return;
    importState.setImportResultMessage("");
    importState.resetReview();

    const data = await readBackupPayload();
    if (!data) return;

    try {
      importState.setValidationResult(await validateBackup.mutateAsync({ mode: importState.importMode, data }));
    } catch (error) {
      importState.setImportResultMessage(getApiErrorDetail(error, "백업 사전 검증에 실패했습니다"));
    }
  };

  const handlePreview = async () => {
    if (!importState.backupFile) return;
    importState.setImportResultMessage("");
    importState.setPreviewResult(null);

    const data = await readBackupPayload();
    if (!data) return;

    try {
      importState.setPreviewResult(await previewBackup.mutateAsync({ mode: importState.importMode, data }));
    } catch (error) {
      importState.setImportResultMessage(getApiErrorDetail(error, "복원 미리보기에 실패했습니다"));
    }
  };

  return {
    backupFile: importState.backupFile,
    importMode: importState.importMode,
    importErrorMessage: importBackup.error
      ? getApiErrorDetail(importBackup.error, "백업 복원 중 오류가 발생했습니다")
      : null,
    importResultMessage: importState.importResultMessage,
    isImporting: importBackup.isPending,
    isPreviewing: previewBackup.isPending,
    isValidating: validateBackup.isPending,
    onBackupFileChange: importState.onBackupFileChange,
    onImport: handleImport,
    onImportModeChange: importState.onImportModeChange,
    onPreview: handlePreview,
    onValidate: handleValidate,
    previewResult: importState.previewResult,
    validationResult: importState.validationResult,
  };
}
