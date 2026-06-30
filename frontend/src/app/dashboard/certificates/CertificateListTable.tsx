import type { Certificate } from "@/features/certificates/api/certificateApi";

import CertificateListRow from "./CertificateListRow";

interface CertificateListTableProps {
  certificates: Certificate[];
  timezone?: string;
  onOpenCertificate: (domain: string) => void;
}

export default function CertificateListTable({
  certificates,
  timezone,
  onOpenCertificate,
}: CertificateListTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400">
            <th className="px-6 py-3 text-left font-medium">도메인</th>
            <th className="px-6 py-3 text-left font-medium">상태</th>
            <th className="px-6 py-3 text-left font-medium">만료일</th>
            <th className="px-6 py-3 text-left font-medium">남은 기간</th>
            <th className="px-6 py-3 text-left font-medium">발급 방식</th>
            <th className="px-6 py-3 text-left font-medium">최근 실패</th>
            <th className="px-6 py-3 text-right font-medium">상세</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {certificates.map((certificate) => (
            <CertificateListRow
              key={certificate.domain}
              certificate={certificate}
              timezone={timezone}
              onOpenCertificate={onOpenCertificate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
