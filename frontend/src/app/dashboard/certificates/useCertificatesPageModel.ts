"use client";

import { useState } from "react";

import { useAuditCertificateSummary } from "@/features/audit/hooks/useAudit";
import type { Certificate } from "@/features/certificates/api/certificateApi";
import {
  useCertificates,
  useRunCertificateCheck,
  useRunCertificatePreflight,
} from "@/features/certificates/hooks/useCertificates";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";

export function useCertificatesPageModel() {
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

  const displayTimezone = timeDisplaySettings?.display_timezone;
  const counts = getCertificateCounts(certificates);
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

  return {
    checkError: {
      error: runCertificateCheck.error,
      isVisible: runCertificateCheck.isError,
    },
    drawer: selectedCertificate
      ? {
          certificate: selectedCertificate,
          isPreflightError: runCertificatePreflight.isError,
          isPreflightPending: runCertificatePreflight.isPending,
          onClose: closeCertificateDrawer,
          onRunPreflight: (domain: string) => runCertificatePreflight.mutate(domain),
          preflightError: runCertificatePreflight.error,
          selectedPreflight,
          timezone: displayTimezone,
        }
      : null,
    header: {
      isRefreshing: isFetching,
      isRunningCheck: runCertificateCheck.isPending,
      onRefresh: () => {
        void refetch();
      },
      onRunCheck: () => runCertificateCheck.mutate(),
    },
    list: {
      certificates,
      isLoading,
      onOpenCertificate: openCertificateDrawer,
      timezone: displayTimezone,
    },
    loadError: {
      error,
      isVisible: isError,
    },
    overview: {
      certificateSummary,
      checkResult: runCertificateCheck.isSuccess ? runCertificateCheck.data : null,
      errorCount: counts.errorCount,
      pendingCount: counts.pendingCount,
      recentFailureCount: counts.recentFailureCount,
      repeatedFailureCount: counts.repeatedFailureCount,
      timezone: displayTimezone,
      totalCount: certificates.length,
      warningCount: counts.warningCount,
    },
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
