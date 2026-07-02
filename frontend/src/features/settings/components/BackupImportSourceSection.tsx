import type { BackupImportMode } from "./BackupRestoreSettingsTypes";

interface BackupImportSourceSectionProps {
  importMode: BackupImportMode;
  onBackupFileChange: (file: File | null) => void;
  onImportModeChange: (mode: BackupImportMode) => void;
}

export function BackupImportSourceSection({
  importMode,
  onBackupFileChange,
  onImportModeChange,
}: BackupImportSourceSectionProps) {
  return (
    <>
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
    </>
  );
}
