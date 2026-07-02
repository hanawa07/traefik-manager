import type {
  BackupPreviewResult,
  BackupValidateResult,
} from "@/features/settings/api/settingsApi";
import { BackupPreviewNotice } from "@/features/settings/components/SettingsNotices";

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
