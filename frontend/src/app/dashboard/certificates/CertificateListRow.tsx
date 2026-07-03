import { ChevronRight } from "lucide-react";

import type { Certificate } from "@/features/certificates/api/certificateApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { CertificateFailureCell } from "./CertificateFailureCell";
import { CertificateIdentityCell } from "./CertificateIdentityCell";
import { CertificateStatusCell } from "./CertificateStatusCell";
import { getRemainingLabel } from "./certificatePageHelpers";

const DETAIL_BUTTON_CLASS = [
  "inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2",
  "text-xs font-medium text-gray-700 transition-colors",
  "hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
].join(" ");

interface CertificateListRowProps {
  certificate: Certificate;
  timezone?: string;
  onOpenCertificate: (domain: string) => void;
}

export default function CertificateListRow({
  certificate,
  timezone,
  onOpenCertificate,
}: CertificateListRowProps) {
  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-gray-50"
      onClick={() => onOpenCertificate(certificate.domain)}
    >
      <td className="px-6 py-4">
        <CertificateIdentityCell certificate={certificate} />
      </td>
      <td className="px-6 py-4">
        <CertificateStatusCell certificate={certificate} />
      </td>
      <td className="px-6 py-3 text-sm text-gray-500">
        {certificate.expires_at ? formatDateTime(certificate.expires_at, timezone) : "-"}
      </td>
      <td className="px-6 py-3 text-sm text-gray-500">{getRemainingLabel(certificate)}</td>
      <td className="px-6 py-3 text-sm text-gray-500">{getResolverLabel(certificate)}</td>
      <td className="px-6 py-3">
        <CertificateFailureCell certificate={certificate} timezone={timezone} />
      </td>
      <td className="px-6 py-3 text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenCertificate(certificate.domain);
          }}
          className={DETAIL_BUTTON_CLASS}
        >
          상세 보기
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function getResolverLabel(certificate: Certificate) {
  if (certificate.cert_resolvers.length === 0) return "수동/미설정";
  return `자동 발급 (${certificate.cert_resolvers.join(", ")})`;
}
