import type { CertificateCheckResult } from "@/features/certificates/api/certificateApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface CertificateCheckResultBannerProps {
  checkResult: CertificateCheckResult | null;
  timezone?: string;
}

export default function CertificateCheckResultBanner({
  checkResult,
  timezone,
}: CertificateCheckResultBannerProps) {
  if (!checkResult) return null;

  const resultDetails = [
    `전체 ${checkResult.total_count}개`,
    `만료 임박 ${checkResult.warning_count}개`,
    `만료 ${checkResult.error_count}개`,
    `신규 경고 ${checkResult.recorded_event_count}건`,
  ].join(" · ");

  return (
    <div className="card mb-6 border-blue-200 bg-blue-50 p-4">
      <p className="text-sm font-medium text-blue-700">인증서 경고 재검사를 완료했습니다</p>
      <p className="mt-1 text-xs text-blue-600">
        {formatDateTime(checkResult.checked_at, timezone)}
        {` · ${resultDetails}`}
      </p>
    </div>
  );
}
