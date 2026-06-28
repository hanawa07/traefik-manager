import { AlertTriangle, ChevronRight, History, Shield } from "lucide-react";

import type { Certificate } from "@/features/certificates/api/certificateApi";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { getFailureSummary, getRemainingLabel } from "./certificatePageHelpers";

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
        <div className="p-6 space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <div className="py-16 text-center text-gray-500">
          <Shield className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">표시할 인증서가 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
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
                <tr
                  key={certificate.domain}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => onOpenCertificate(certificate.domain)}
                >
                  <td className="px-6 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{certificate.domain}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        라우터 {certificate.router_names.length > 0 ? certificate.router_names.length : 0}개
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={certificate.status} />
                        {certificate.alerts_suppressed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            <History className="h-3 w-3" />
                            억제 중
                          </span>
                        ) : null}
                        {certificate.preflight_repeated_failure_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                            <AlertTriangle className="h-3 w-3" />
                            반복 실패 x{certificate.preflight_failure_streak}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-500">{certificate.status_message}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {certificate.expires_at ? formatDateTime(certificate.expires_at, timezone) : "-"}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{getRemainingLabel(certificate)}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {certificate.cert_resolvers.length > 0
                      ? `자동 발급 (${certificate.cert_resolvers.join(", ")})`
                      : "수동/미설정"}
                  </td>
                  <td className="px-6 py-3">
                    <div className="max-w-[280px]">
                      <p className={`line-clamp-2 text-sm ${getFailureSummary(certificate).tone}`}>
                        {getFailureSummary(certificate).label}
                      </p>
                      {certificate.last_acme_error_at ? (
                        <p className="mt-1 text-[11px] text-gray-400">
                          {formatDateTime(certificate.last_acme_error_at, timezone)}
                        </p>
                      ) : null}
                      {certificate.preflight_repeated_failure_active ? (
                        <p className="mt-1 text-[11px] text-rose-600">
                          같은 실패가 {certificate.preflight_failure_streak}회 연속 반복되었습니다
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenCertificate(certificate.domain);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      상세 보기
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
