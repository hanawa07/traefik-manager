import { Settings, ShieldCheck } from "lucide-react";

interface BackupReviewActionsSectionProps {
  backupFile: File | null;
  isPreviewing: boolean;
  isValidating: boolean;
  onPreview: () => void;
  onValidate: () => void;
}

export function BackupReviewActionsSection({
  backupFile,
  isPreviewing,
  isValidating,
  onPreview,
  onValidate,
}: BackupReviewActionsSectionProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        className="btn-secondary inline-flex w-full items-center justify-center gap-2"
        onClick={onValidate}
        disabled={!backupFile || isValidating}
      >
        <ShieldCheck className="h-4 w-4" />
        {isValidating ? "검증 중..." : "JSON 사전 검증"}
      </button>

      <button
        type="button"
        className="btn-secondary inline-flex w-full items-center justify-center gap-2"
        onClick={onPreview}
        disabled={!backupFile || isPreviewing}
      >
        <Settings className="h-4 w-4" />
        {isPreviewing ? "미리보기 계산 중..." : "복원 미리보기"}
      </button>
    </div>
  );
}
