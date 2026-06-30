import type { AuditCertificateSummary } from "@/features/audit/api/auditApi";
import type { CertificateCheckResult } from "@/features/certificates/api/certificateApi";

import CertificateCheckResultBanner from "./CertificateCheckResultBanner";
import CertificateChecklistGuide from "./CertificateChecklistGuide";
import CertificateRecentEventsPanel from "./CertificateRecentEventsPanel";
import CertificateSummaryCards from "./CertificateSummaryCards";

interface CertificateOverviewPanelsProps {
  checkResult: CertificateCheckResult | null;
  totalCount: number;
  pendingCount: number;
  warningCount: number;
  errorCount: number;
  recentFailureCount: number;
  repeatedFailureCount: number;
  certificateSummary: AuditCertificateSummary | undefined;
  timezone: string | undefined;
}

export default function CertificateOverviewPanels({
  checkResult,
  totalCount,
  pendingCount,
  warningCount,
  errorCount,
  recentFailureCount,
  repeatedFailureCount,
  certificateSummary,
  timezone,
}: CertificateOverviewPanelsProps) {
  return (
    <>
      <CertificateCheckResultBanner checkResult={checkResult} timezone={timezone} />
      <CertificateSummaryCards
        totalCount={totalCount}
        pendingCount={pendingCount}
        warningCount={warningCount}
        errorCount={errorCount}
        recentFailureCount={recentFailureCount}
        repeatedFailureCount={repeatedFailureCount}
      />
      <CertificateChecklistGuide />
      <CertificateRecentEventsPanel
        certificateSummary={certificateSummary}
        timezone={timezone}
      />
    </>
  );
}
