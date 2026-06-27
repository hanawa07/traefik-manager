import { Download, Settings, ShieldCheck, Upload } from "lucide-react";

import type {
  BackupPreviewResult,
  BackupValidateResult,
} from "@/features/settings/api/settingsApi";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";
import { BackupPreviewNotice } from "@/features/settings/components/SettingsNotices";

type BackupImportMode = "merge" | "overwrite";

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
        <button
          type="button"
          className="btn-secondary w-full inline-flex items-center justify-center gap-2"
          onClick={onExport}
          disabled={isExporting}
        >
          <Download className="w-4 h-4" />
          {isExporting ? "내보내는 중..." : "설정 JSON 내보내기"}
        </button>
        {exportErrorMessage && <p className="text-xs text-red-600">{exportErrorMessage}</p>}

        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">JSON 복원</p>
          <input
            type="file"
            accept="application/json"
            className="input"
            onChange={(event) => onBackupFileChange(event.target.files?.[0] || null)}
          />

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="radio"
                className="accent-blue-600"
                checked={importMode === "merge"}
                onChange={() => onImportModeChange("merge")}
              />
              병합 (기존 데이터 유지)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="radio"
                className="accent-blue-600"
                checked={importMode === "overwrite"}
                onChange={() => onImportModeChange("overwrite")}
              />
              덮어쓰기 (기존 데이터 삭제 후 복원)
            </label>
          </div>

          <button
            type="button"
            className="btn-secondary w-full inline-flex items-center justify-center gap-2"
            onClick={onValidate}
            disabled={!backupFile || isValidating}
          >
            <ShieldCheck className="w-4 h-4" />
            {isValidating ? "검증 중..." : "JSON 사전 검증"}
          </button>

          <button
            type="button"
            className="btn-secondary w-full inline-flex items-center justify-center gap-2"
            onClick={onPreview}
            disabled={!backupFile || isPreviewing}
          >
            <Settings className="w-4 h-4" />
            {isPreviewing ? "미리보기 계산 중..." : "복원 미리보기"}
          </button>

          <BackupValidationNotice result={validationResult} />
          <BackupPreviewNotice result={previewResult} />

          <button
            type="button"
            className="btn-primary w-full inline-flex items-center justify-center gap-2"
            onClick={onImport}
            disabled={!canManage || !backupFile || isImporting}
          >
            <Upload className="w-4 h-4" />
            {isImporting ? "복원 중..." : "설정 JSON 가져오기"}
          </button>
          {!canManage ? (
            <p className="text-xs text-gray-500">viewer 계정은 백업 복원을 실행할 수 없습니다.</p>
          ) : null}

          {importErrorMessage ? (
            <p className="text-xs text-red-600">{importErrorMessage}</p>
          ) : null}
          {importResultMessage && <p className="text-xs text-green-700">{importResultMessage}</p>}
        </div>
      </div>
    </div>
  );
}

function BackupValidationNotice({ result }: { result: BackupValidateResult | null }) {
  if (!result) return null;

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
      <p className="font-medium">
        검증 완료: 서비스 {result.service_count}개, 리다이렉트 {result.redirect_count}개
      </p>
      <p className="mt-1 text-xs">경고 {result.warning_count}개</p>
      {result.warnings.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {result.warnings.map((warning) => (
            <li key={warning}>- {warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
