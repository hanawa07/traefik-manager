import { getApiErrorDetail } from "@/features/settings/lib/settingsErrors";
import {
  useImportBackup,
  usePreviewBackup,
  useValidateBackup,
} from "@/features/settings/hooks/useSettings";
import {
  formatBackupImportResult,
  formatBackupPreviewResult,
  formatBackupValidationResult,
  readBackupPayloadFile,
} from "./backupImportActionHelpers";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
import { useBackupImportState } from "./useBackupImportState";

export function useBackupImportActions(canManage: boolean, onToast: (notice: ToastNoticeValue) => void) {
  const importState = useBackupImportState();
  const importBackup = useImportBackup();
  const validateBackup = useValidateBackup();
  const previewBackup = usePreviewBackup();

  const readBackupPayload = async () => {
    if (!importState.backupFile) return null;

    const result = await readBackupPayloadFile(importState.backupFile);
    if (!result.ok) {
      importState.setImportResultMessage(result.errorMessage);
      onToast({
        tone: "warning",
        message: "백업 파일 확인 필요",
        detail: result.errorMessage,
      });
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
      const resultMessage = formatBackupImportResult(result);
      importState.setImportResultMessage(resultMessage);
      importState.setBackupFile(null);
      onToast({
        tone: "success",
        message: "백업 복원 완료",
        detail: resultMessage,
      });
    } catch {
      onToast({
        tone: "error",
        message: "백업 복원 실패",
        detail: "설정 JSON 가져오기를 완료하지 못했습니다.",
      });
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
      const result = await validateBackup.mutateAsync({ mode: importState.importMode, data });
      importState.setValidationResult(result);
      onToast({
        tone: "success",
        message: "백업 사전 검증 완료",
        detail: formatBackupValidationResult(result),
      });
    } catch (error) {
      const message = getApiErrorDetail(error, "백업 사전 검증에 실패했습니다");
      importState.setImportResultMessage(message);
      onToast({
        tone: "error",
        message: "백업 사전 검증 실패",
        detail: message,
      });
    }
  };

  const handlePreview = async () => {
    if (!importState.backupFile) return;
    importState.setImportResultMessage("");
    importState.setPreviewResult(null);

    const data = await readBackupPayload();
    if (!data) return;

    try {
      const result = await previewBackup.mutateAsync({ mode: importState.importMode, data });
      importState.setPreviewResult(result);
      onToast({
        tone: "success",
        message: "복원 미리보기 완료",
        detail: formatBackupPreviewResult(result),
      });
    } catch (error) {
      const message = getApiErrorDetail(error, "복원 미리보기에 실패했습니다");
      importState.setImportResultMessage(message);
      onToast({
        tone: "error",
        message: "복원 미리보기 실패",
        detail: message,
      });
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
