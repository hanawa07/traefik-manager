import type {
  Certificate,
  CertificatePreflightResult,
} from "@/features/certificates/api/certificateApi";

import CertificateDetailDrawerBody from "./CertificateDetailDrawerBody";
import CertificateDetailDrawerHeader from "./CertificateDetailDrawerHeader";

interface CertificateDetailDrawerProps {
  certificate: Certificate;
  selectedPreflight: CertificatePreflightResult | null;
  isPreflightPending: boolean;
  isPreflightError: boolean;
  preflightError: unknown;
  timezone?: string;
  onClose: () => void;
  onRunPreflight: (domain: string) => void;
}

export default function CertificateDetailDrawer({
  certificate,
  selectedPreflight,
  isPreflightPending,
  isPreflightError,
  preflightError,
  timezone,
  onClose,
  onRunPreflight,
}: CertificateDetailDrawerProps) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-slate-950">
        <CertificateDetailDrawerHeader certificate={certificate} onClose={onClose} />
        <CertificateDetailDrawerBody
          certificate={certificate}
          selectedPreflight={selectedPreflight}
          isPreflightPending={isPreflightPending}
          isPreflightError={isPreflightError}
          preflightError={preflightError}
          timezone={timezone}
          onRunPreflight={onRunPreflight}
        />
      </aside>
    </div>
  );
}
