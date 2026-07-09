import type { Certificate } from "@/features/certificates/api/certificateApi";

interface CertificateIdentityCellProps {
  certificate: Certificate;
}

export function CertificateIdentityCell({ certificate }: CertificateIdentityCellProps) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{certificate.domain}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        라우터 {certificate.router_names.length}개
      </p>
    </div>
  );
}
