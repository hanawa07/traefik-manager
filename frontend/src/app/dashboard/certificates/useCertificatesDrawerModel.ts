"use client";

import { useState } from "react";

import type {
  Certificate,
  CertificatePreflightResult,
} from "@/features/certificates/api/certificateApi";

interface UseCertificatesDrawerModelArgs {
  certificates: Certificate[];
  displayTimezone?: string;
  preflightData?: CertificatePreflightResult;
  preflightError: unknown;
  isPreflightError: boolean;
  isPreflightPending: boolean;
  resetPreflight: () => void;
  runPreflight: (domain: string) => void;
}

export function useCertificatesDrawerModel({
  certificates,
  displayTimezone,
  preflightData,
  preflightError,
  isPreflightError,
  isPreflightPending,
  resetPreflight,
  runPreflight,
}: UseCertificatesDrawerModelArgs) {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const selectedCertificate = selectedDomain
    ? certificates.find((item) => item.domain === selectedDomain) ?? null
    : null;
  const selectedPreflight =
    preflightData && preflightData.domain === selectedDomain ? preflightData : null;

  const openCertificateDrawer = (domain: string) => {
    setSelectedDomain(domain);
    runPreflight(domain);
  };

  const closeCertificateDrawer = () => {
    setSelectedDomain(null);
    resetPreflight();
  };

  return {
    drawer: selectedCertificate
      ? {
          certificate: selectedCertificate,
          isPreflightError,
          isPreflightPending,
          onClose: closeCertificateDrawer,
          onRunPreflight: runPreflight,
          preflightError,
          selectedPreflight,
          timezone: displayTimezone,
        }
      : null,
    openCertificateDrawer,
  };
}
