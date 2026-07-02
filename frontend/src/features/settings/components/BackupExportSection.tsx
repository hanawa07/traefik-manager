import { Download } from "lucide-react";

interface BackupExportSectionProps {
  errorMessage: string;
  isExporting: boolean;
  onExport: () => void;
}

export function BackupExportSection({
  errorMessage,
  isExporting,
  onExport,
}: BackupExportSectionProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-secondary inline-flex w-full items-center justify-center gap-2"
        onClick={onExport}
        disabled={isExporting}
      >
        <Download className="h-4 w-4" />
        {isExporting ? "내보내는 중..." : "설정 JSON 내보내기"}
      </button>
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
