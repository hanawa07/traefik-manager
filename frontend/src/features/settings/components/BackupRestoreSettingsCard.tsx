import { Settings } from "lucide-react";

import type {
  BackupPreviewResult,
  BackupValidateResult,
} from "@/features/settings/api/settingsApi";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";
import { BackupExportSection } from "./BackupExportSection";
import { BackupImportExecutionSection } from "./BackupImportExecutionSection";
import { BackupImportSourceSection } from "./BackupImportSourceSection";
import { BackupReviewActionsSection } from "./BackupReviewActionsSection";
import { BackupReviewResultsSection } from "./BackupReviewResultsSection";
import type { BackupImportMode } from "./BackupRestoreSettingsTypes";

interface BackupRestoreSettingsCardProps {
  canManage: boolean;
  backupFile: File | null;
  importMode: BackupImportMode;
  validationResult: BackupValidateResult | null;
  previewResult: BackupPreviewResult | null;
  exportErrorMessage: string;
  importErrorMessage: string | null;
  importResultMessage: string;
  isExporting: boolean;
  isValidating: boolean;
  isPreviewing: boolean;
  isImporting: boolean;
  onExport: () => void;
  onValidate: () => void;
  onPreview: () => void;
  onImport: () => void;
  onBackupFileChange: (file: File | null) => void;
  onImportModeChange: (mode: BackupImportMode) => void;
}

export function BackupRestoreSettingsCard({
  canManage,
  backupFile,
  importMode,
  validationResult,
  previewResult,
  exportErrorMessage,
  importErrorMessage,
  importResultMessage,
  isExporting,
  isValidating,
  isPreviewing,
  isImporting,
  onExport,
  onValidate,
  onPreview,
  onImport,
  onBackupFileChange,
  onImportModeChange,
}: BackupRestoreSettingsCardProps) {
  return (
    <div className="card p-6 h-full order-8">
      <SettingsCardHeader
        icon={<Settings className="w-5 h-5 text-indigo-600" />}
        title="백업 / 복원"
        description="현재 설정을 JSON으로 내보내거나, 백업 파일을 병합 또는 덮어쓰기 방식으로 복원합니다."
      />

      <div className="space-y-4">
        <BackupExportSection
          errorMessage={exportErrorMessage}
          isExporting={isExporting}
          onExport={onExport}
        />

        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">JSON 복원</p>
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
            errorMessage={importErrorMessage}
            isImporting={isImporting}
            resultMessage={importResultMessage}
            onImport={onImport}
          />
        </div>
      </div>
    </div>
  );
}
