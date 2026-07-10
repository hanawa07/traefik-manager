import type {
  Certificate,
  CertificatePreflightResult,
} from "@/features/certificates/api/certificateApi";

import CertificateAcmeFailureSection from "./CertificateAcmeFailureSection";
import CertificateChecklistSection from "./CertificateChecklistSection";
import CertificateDetailFacts from "./CertificateDetailFacts";
import CertificatePreflightSection from "./CertificatePreflightSection";

interface CertificateDetailDrawerBodyProps {
  certificate: Certificate;
  selectedPreflight: CertificatePreflightResult | null;
  isPreflightPending: boolean;
  isPreflightError: boolean;
  preflightError: unknown;
  timezone?: string;
  onRunPreflight: (domain: string) => void;
}

export default function CertificateDetailDrawerBody({
  certificate,
  selectedPreflight,
  isPreflightPending,
  isPreflightError,
  preflightError,
  timezone,
  onRunPreflight,
}: CertificateDetailDrawerBodyProps) {
  return (
    <div className="flex-1 space-y-4 overscroll-contain overflow-y-auto px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5">
      <CertificateDetailFacts certificate={certificate} timezone={timezone} />
      <CertificateChecklistSection
        certificate={certificate}
        isRunning={isPreflightPending}
        onRunPreflight={() => onRunPreflight(certificate.domain)}
      />
      <CertificateAcmeFailureSection certificate={certificate} timezone={timezone} />
      <CertificatePreflightSection
        preflight={selectedPreflight}
        isPending={isPreflightPending}
        isError={isPreflightError}
        error={preflightError}
        timezone={timezone}
      />
    </div>
  );
}
