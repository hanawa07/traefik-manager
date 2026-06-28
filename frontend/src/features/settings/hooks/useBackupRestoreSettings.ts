import { useState } from "react";

import type {
  BackupPayload,
  BackupPreviewResult,
  BackupValidateResult,
} from "@/features/settings/api/settingsApi";
import { getApiErrorDetail } from "@/features/settings/lib/settingsErrors";
import {
  useExportBackup,
  useImportBackup,
  usePreviewBackup,
  useValidateBackup,
} from "@/features/settings/hooks/useSettings";

type BackupImportMode = "merge" | "overwrite";

export function useBackupRestoreSettings(canManage: boolean) {
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<BackupImportMode>("merge");
  const [importResultMessage, setImportResultMessage] = useState("");
  const [exportErrorMessage, setExportErrorMessage] = useState("");
  const [validationResult, setValidationResult] = useState<BackupValidateResult | null>(null);
  const [previewResult, setPreviewResult] = useState<BackupPreviewResult | null>(null);

  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();
  const validateBackup = useValidateBackup();
  const previewBackup = usePreviewBackup();

  const resetReview = () => {
    setValidationResult(null);
    setPreviewResult(null);
  };

  const readBackupPayload = async () => {
    if (!backupFile) return null;

    try {
      return JSON.parse(await backupFile.text()) as BackupPayload;
    } catch {
      setImportResultMessage("유효하지 않은 JSON 파일입니다");
      return null;
    }
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

  const handleExport = async () => {
    setExportErrorMessage("");
    try {
      const data = await exportBackup.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `traefik-manager-backup-${now}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportErrorMessage("백업 내보내기에 실패했습니다");
    }
  };

  const handleImport = async () => {
    if (!canManage || !backupFile) return;
    setImportResultMessage("");
    resetReview();

    const data = await readBackupPayload();
    if (!data) return;

    try {
      const result = await importBackup.mutateAsync({ mode: importMode, data });
      setImportResultMessage(
        `가져오기 완료: 서비스 생성 ${result.created_services}개, 서비스 수정 ${result.updated_services}개, 리다이렉트 생성 ${result.created_redirects}개, 리다이렉트 수정 ${result.updated_redirects}개`,
      );
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
    validationResult,
    previewResult,
    exportErrorMessage,
    importErrorMessage: importBackup.error
      ? getApiErrorDetail(importBackup.error, "백업 복원 중 오류가 발생했습니다")
      : null,
    importResultMessage,
    isExporting: exportBackup.isPending,
    isValidating: validateBackup.isPending,
    isPreviewing: previewBackup.isPending,
    isImporting: importBackup.isPending,
    onExport: handleExport,
    onValidate: handleValidate,
    onPreview: handlePreview,
    onImport: handleImport,
    onBackupFileChange: handleBackupFileChange,
    onImportModeChange: handleImportModeChange,
  };
}
