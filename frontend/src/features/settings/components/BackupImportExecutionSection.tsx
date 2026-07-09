import { Upload } from "lucide-react";

interface BackupImportExecutionSectionProps {
  backupFile: File | null;
  canManage: boolean;
  errorMessage: string | null;
  isImporting: boolean;
  resultMessage: string;
  onImport: () => void;
}

export function BackupImportExecutionSection({
  backupFile,
  canManage,
  errorMessage,
  isImporting,
  resultMessage,
  onImport,
}: BackupImportExecutionSectionProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary inline-flex w-full items-center justify-center gap-2"
        onClick={onImport}
        disabled={!canManage || !backupFile || isImporting}
      >
        <Upload className="h-4 w-4" />
        {isImporting ? "복원 중..." : "설정 JSON 가져오기"}
      </button>
      {!canManage ? (
        <p className="text-xs text-gray-500 dark:text-slate-400">viewer 계정은 백업 복원을 실행할 수 없습니다.</p>
      ) : null}
      {errorMessage ? <p className="text-xs text-red-600 dark:text-red-300">{errorMessage}</p> : null}
      {resultMessage ? <p className="text-xs text-green-700 dark:text-emerald-300">{resultMessage}</p> : null}
    </div>
  );
}
