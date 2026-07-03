import { useState } from "react";

import type {
  BackupPreviewResult,
  BackupValidateResult,
} from "@/features/settings/api/settingsApi";
import type { BackupImportMode } from "@/features/settings/lib/backupImportTypes";

export function useBackupImportState() {
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<BackupImportMode>("merge");
  const [importResultMessage, setImportResultMessage] = useState("");
  const [validationResult, setValidationResult] = useState<BackupValidateResult | null>(null);
  const [previewResult, setPreviewResult] = useState<BackupPreviewResult | null>(null);

  const resetReview = () => {
    setValidationResult(null);
    setPreviewResult(null);
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

  return {
    backupFile,
    importMode,
    importResultMessage,
    previewResult,
    resetReview,
    setBackupFile,
    setImportResultMessage,
    setPreviewResult,
    setValidationResult,
    validationResult,
    onBackupFileChange: handleBackupFileChange,
    onImportModeChange: handleImportModeChange,
  };
}
