import type { Certificate } from "@/features/certificates/api/certificateApi";

import { getCertificateChecklist } from "./certificatePageHelpers";
import CertificateChecklistAction from "./CertificateChecklistAction";
import CertificateChecklistGrid from "./CertificateChecklistGrid";
import CertificateChecklistHeader from "./CertificateChecklistHeader";

interface CertificateChecklistSectionProps {
  certificate: Certificate;
  isRunning: boolean;
  onRunPreflight: () => void;
}

export default function CertificateChecklistSection({
  certificate,
  isRunning,
  onRunPreflight,
}: CertificateChecklistSectionProps) {
  const checklist = getCertificateChecklist(certificate);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <CertificateChecklistHeader
        isRunning={isRunning}
        onRunPreflight={onRunPreflight}
      />
      <CertificateChecklistAction action={checklist.action} />
      <CertificateChecklistGrid items={checklist.items} />
    </section>
  );
}
