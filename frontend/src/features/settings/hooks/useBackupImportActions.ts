import { useState } from "react";

import type {
  BackupPreviewResult,
  BackupValidateResult,
} from "@/features/settings/api/settingsApi";
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

type BackupImportMode = "merge" | "overwrite";

export function useBackupImportActions(canManage: boolean) {
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<BackupImportMode>("merge");
  const [importResultMessage, setImportResultMessage] = useState("");
  const [validationResult, setValidationResult] = useState<BackupValidateResult | null>(null);
  const [previewResult, setPreviewResult] = useState<BackupPreviewResult | null>(null);

  const importBackup = useImportBackup();
  const validateBackup = useValidateBackup();
  const previewBackup = usePreviewBackup();

  const resetReview = () => {
    setValidationResult(null);
    setPreviewResult(null);
  };

  const readBackupPayload = async () => {
    if (!backupFile) return null;

    const result = await readBackupPayloadFile(backupFile);
    if (!result.ok) {
      setImportResultMessage(result.errorMessage);
      return null;
    }

    return result.data;
  };

  const handleBackupFileChange = (file: File | null) => {
    setBackupFile(file);
    resetReview();
    setImportResultMessage("");
  };

  const handleImportModeChange = (mode: BackupImportMode) => {
    setImportMode(mode);
    resetReview();
  };

  const handleImport = async () => {
    if (!canManage || !backupFile) return;
    setImportResultMessage("");
    resetReview();

    const data = await readBackupPayload();
    if (!data) return;

    try {
      const result = await importBackup.mutateAsync({ mode: importMode, data });
      setImportResultMessage(formatBackupImportResult(result));
      setBackupFile(null);
    } catch {
      return;
    }
  };

  const handleValidate = async () => {
    if (!backupFile) return;
    setImportResultMessage("");
    resetReview();

    const data = await readBackupPayload();
    if (!data) return;

    try {
      setValidationResult(await validateBackup.mutateAsync({ mode: importMode, data }));
    } catch (error) {
      setImportResultMessage(getApiErrorDetail(error, "백업 사전 검증에 실패했습니다"));
    }
  };

  const handlePreview = async () => {
    if (!backupFile) return;
    setImportResultMessage("");
    setPreviewResult(null);

    const data = await readBackupPayload();
    if (!data) return;

    try {
      setPreviewResult(await previewBackup.mutateAsync({ mode: importMode, data }));
    } catch (error) {
      setImportResultMessage(getApiErrorDetail(error, "복원 미리보기에 실패했습니다"));
    }
  };

  return {
    backupFile,
    importMode,
    importErrorMessage: importBackup.error
      ? getApiErrorDetail(importBackup.error, "백업 복원 중 오류가 발생했습니다")
      : null,
    importResultMessage,
    isImporting: importBackup.isPending,
    isPreviewing: previewBackup.isPending,
    isValidating: validateBackup.isPending,
    onBackupFileChange: handleBackupFileChange,
    onImport: handleImport,
    onImportModeChange: handleImportModeChange,
    onPreview: handlePreview,
    onValidate: handleValidate,
    previewResult,
    validationResult,
  };
}
