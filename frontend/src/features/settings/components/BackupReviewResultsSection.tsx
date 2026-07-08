import type {
  BackupPreviewResult,
  BackupValidateResult,
} from "@/features/settings/api/settingsApi";
import { BackupPreviewNotice } from "@/features/settings/components/SettingsNotices";
import { formatBackupValidationResult } from "@/features/settings/hooks/backupImportActionHelpers";

interface BackupReviewResultsSectionProps {
  previewResult: BackupPreviewResult | null;
  validationResult: BackupValidateResult | null;
}

export function BackupReviewResultsSection({
  previewResult,
  validationResult,
}: BackupReviewResultsSectionProps) {
  return (
    <>
      <BackupValidationNotice result={validationResult} />
      <BackupPreviewNotice result={previewResult} />
    </>
  );
}

function BackupValidationNotice({ result }: { result: BackupValidateResult | null }) {
  if (!result) return null;

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
      <p className="font-medium">검증 완료: {formatBackupValidationResult(result)}</p>
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
