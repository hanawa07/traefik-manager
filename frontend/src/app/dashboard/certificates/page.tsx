"use client";
import { useState } from "react";

import { useCertificates, useRunCertificateCheck, useRunCertificatePreflight } from "@/features/certificates/hooks/useCertificates";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import { useAuditCertificateSummary } from "@/features/audit/hooks/useAudit";
import CertificateDetailDrawer from "./CertificateDetailDrawer";
import CertificateErrorBanner from "./CertificateErrorBanner";
import CertificateListCard from "./CertificateListCard";
import CertificatePageHeader from "./CertificatePageHeader";
import CertificateOverviewPanels from "./CertificateOverviewPanels";

export default function CertificatesPage() {
  const {
    data: certificates = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useCertificates();
  const runCertificateCheck = useRunCertificateCheck();
  const runCertificatePreflight = useRunCertificatePreflight();
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const { data: certificateSummary } = useAuditCertificateSummary({ recent_limit: 5 });
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const warningCount = certificates.filter((item) => item.status === "warning").length;
  const errorCount = certificates.filter((item) => item.status === "error").length;
  const pendingCount = certificates.filter((item) => item.status === "pending").length;
  const recentFailureCount = certificates.filter((item) => item.last_acme_error_message).length;
  const repeatedFailureCount = certificates.filter((item) => item.preflight_repeated_failure_active).length;

  const selectedCertificate = selectedDomain
    ? certificates.find((item) => item.domain === selectedDomain) ?? null
    : null;
  const selectedPreflight =
    runCertificatePreflight.data && runCertificatePreflight.data.domain === selectedDomain
      ? runCertificatePreflight.data
      : null;

  const openCertificateDrawer = (domain: string) => {
    setSelectedDomain(domain);
    runCertificatePreflight.mutate(domain);
  };

  const closeCertificateDrawer = () => {
    setSelectedDomain(null);
    runCertificatePreflight.reset();
  };

  return (
    <div className="p-8">
      <CertificatePageHeader
        isRefreshing={isFetching}
        isRunningCheck={runCertificateCheck.isPending}
        onRefresh={() => refetch()}
        onRunCheck={() => runCertificateCheck.mutate()}
      />

      <CertificateOverviewPanels
        checkResult={runCertificateCheck.isSuccess ? runCertificateCheck.data : null}
        totalCount={certificates.length}
        pendingCount={pendingCount}
        warningCount={warningCount}
        errorCount={errorCount}
        recentFailureCount={recentFailureCount}
        repeatedFailureCount={repeatedFailureCount}
        certificateSummary={certificateSummary}
        timezone={timeDisplaySettings?.display_timezone}
      />

      {isError && (
        <CertificateErrorBanner
          title="인증서 정보를 가져오지 못했습니다"
          error={error}
          fallback="잠시 후 다시 시도해 주세요"
        />
      )}

      {runCertificateCheck.isError && (
        <CertificateErrorBanner
          title="인증서 경고 재검사에 실패했습니다"
          error={runCertificateCheck.error}
          fallback="잠시 후 다시 시도해 주세요"
        />
      )}

      <CertificateListCard
        certificates={certificates}
        isLoading={isLoading}
        timezone={timeDisplaySettings?.display_timezone}
        onOpenCertificate={openCertificateDrawer}
      />
      {selectedCertificate ? (
        <CertificateDetailDrawer
          certificate={selectedCertificate}
          selectedPreflight={selectedPreflight}
          isPreflightPending={runCertificatePreflight.isPending}
          isPreflightError={runCertificatePreflight.isError}
          preflightError={runCertificatePreflight.error}
          timezone={timeDisplaySettings?.display_timezone}
          onClose={closeCertificateDrawer}
          onRunPreflight={(domain) => runCertificatePreflight.mutate(domain)}
        />
      ) : null}
    </div>
  );
}
