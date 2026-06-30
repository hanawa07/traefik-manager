import type { Certificate } from "@/features/certificates/api/certificateApi";

import CertificateListEmpty from "./CertificateListEmpty";
import CertificateListLoading from "./CertificateListLoading";
import CertificateListTable from "./CertificateListTable";

interface CertificateListCardProps {
  certificates: Certificate[];
  isLoading: boolean;
  timezone?: string;
  onOpenCertificate: (domain: string) => void;
}

export default function CertificateListCard({
  certificates,
  isLoading,
  timezone,
  onOpenCertificate,
}: CertificateListCardProps) {
  return (
    <div className="card overflow-hidden">
      {isLoading ? (
        <CertificateListLoading />
      ) : certificates.length === 0 ? (
        <CertificateListEmpty />
      ) : (
        <CertificateListTable
          certificates={certificates}
          timezone={timezone}
          onOpenCertificate={onOpenCertificate}
        />
      )}
    </div>
  );
}
