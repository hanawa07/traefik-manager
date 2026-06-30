import type { AuditCertificateSummary } from "@/features/audit/api/auditApi";
import type {
  Certificate,
  CertificateCheckResult,
} from "@/features/certificates/api/certificateApi";

interface UseCertificatesOverviewModelArgs {
  certificates: Certificate[];
  certificateSummary: AuditCertificateSummary | undefined;
  checkResult: CertificateCheckResult | null;
  displayTimezone?: string;
}

export function useCertificatesOverviewModel({
  certificates,
  certificateSummary,
  checkResult,
  displayTimezone,
}: UseCertificatesOverviewModelArgs) {
  const counts = getCertificateCounts(certificates);

  return {
    certificateSummary,
    checkResult,
    errorCount: counts.errorCount,
    pendingCount: counts.pendingCount,
    recentFailureCount: counts.recentFailureCount,
    repeatedFailureCount: counts.repeatedFailureCount,
    timezone: displayTimezone,
    totalCount: certificates.length,
    warningCount: counts.warningCount,
  };
}

function getCertificateCounts(certificates: Certificate[]) {
  return {
    errorCount: certificates.filter((item) => item.status === "error").length,
    pendingCount: certificates.filter((item) => item.status === "pending").length,
    recentFailureCount: certificates.filter((item) => item.last_acme_error_message).length,
    repeatedFailureCount: certificates.filter((item) => item.preflight_repeated_failure_active)
      .length,
    warningCount: certificates.filter((item) => item.status === "warning").length,
  };
}
