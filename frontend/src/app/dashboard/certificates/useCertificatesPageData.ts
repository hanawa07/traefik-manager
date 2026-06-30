"use client";

import { useAuditCertificateSummary } from "@/features/audit/hooks/useAudit";
import {
  useCertificates,
  useRunCertificateCheck,
  useRunCertificatePreflight,
} from "@/features/certificates/hooks/useCertificates";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";

export function useCertificatesPageData() {
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

  return {
    certificateSummary,
    certificates,
    displayTimezone: timeDisplaySettings?.display_timezone,
    error,
    isError,
    isFetching,
    isLoading,
    refetch,
    runCertificateCheck,
    runCertificatePreflight,
  };
}
