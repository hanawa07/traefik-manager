import type {
  BackupPreviewResult,
  BackupValidateResult,
} from "@/features/settings/api/settingsApi";
import { BackupImportExecutionSection } from "./BackupImportExecutionSection";
import { BackupImportSourceSection } from "./BackupImportSourceSection";
import { BackupReviewActionsSection } from "./BackupReviewActionsSection";
import { BackupReviewResultsSection } from "./BackupReviewResultsSection";
import type { BackupImportMode } from "./BackupRestoreSettingsTypes";

interface BackupImportSectionProps {
  backupFile: File | null;
  canManage: boolean;
  errorMessage: string | null;
  importMode: BackupImportMode;
  isImporting: boolean;
  isPreviewing: boolean;
  isValidating: boolean;
  previewResult: BackupPreviewResult | null;
  resultMessage: string;
  validationResult: BackupValidateResult | null;
  onBackupFileChange: (file: File | null) => void;
  onImport: () => void;
  onImportModeChange: (mode: BackupImportMode) => void;
  onPreview: () => void;
  onValidate: () => void;
}

export function BackupImportSection({
  backupFile,
  canManage,
  errorMessage,
  importMode,
  isImporting,
  isPreviewing,
  isValidating,
  previewResult,
  resultMessage,
  validationResult,
  onBackupFileChange,
  onImport,
  onImportModeChange,
  onPreview,
  onValidate,
}: BackupImportSectionProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 dark:border-slate-700 dark:bg-slate-950/40">
      <p className="text-sm font-medium text-gray-700 dark:text-slate-200">JSON 복원</p>
      <BackupImportSourceSection
        importMode={importMode}
        onBackupFileChange={onBackupFileChange}
        onImportModeChange={onImportModeChange}
      />
      <BackupReviewActionsSection
        backupFile={backupFile}
        isPreviewing={isPreviewing}
        isValidating={isValidating}
        onPreview={onPreview}
        onValidate={onValidate}
      />
      <BackupReviewResultsSection
        previewResult={previewResult}
        validationResult={validationResult}
      />
      <BackupImportExecutionSection
        backupFile={backupFile}
        canManage={canManage}
        errorMessage={errorMessage}
        isImporting={isImporting}
        resultMessage={resultMessage}
        onImport={onImport}
      />
    </div>
  );
}
