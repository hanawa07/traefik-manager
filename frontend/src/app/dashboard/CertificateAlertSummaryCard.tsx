import { Activity, AlertTriangle, Shield } from "lucide-react";
import Link from "next/link";

import type { AuditCertificateSummary } from "@/features/audit/api/auditApi";
import type { Certificate } from "@/features/certificates/api/certificateApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";
import { DashboardStatCard } from "./DashboardStatCard";

interface CertificateAlertSummaryCardProps {
  certificates: Certificate[];
  summary?: AuditCertificateSummary;
  timezone?: string;
}

export function CertificateAlertSummaryCard({
  certificates,
  summary,
  timezone,
}: CertificateAlertSummaryCardProps) {
  const warningCount = certificates.filter((item) => item.status === "warning").length;
  const errorCount = certificates.filter((item) => item.status === "error").length;

  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">운영 경고 요약</h2>
          <p className="mt-1 text-xs text-gray-500">
            현재 인증서 상태와 최근 {formatDurationMinutes(summary?.window_minutes ?? 43200)} 기준 경고 전환입니다.
          </p>
        </div>
        <Link href="/dashboard/certificates" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          인증서 보기
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardStatCard icon={Shield} label="전체 인증서" value={certificates.length} color="bg-slate-500" />
        <DashboardStatCard icon={AlertTriangle} label="만료 임박" value={warningCount} color="bg-amber-500" />
        <DashboardStatCard icon={Shield} label="만료됨" value={errorCount} color="bg-rose-500" />
        <DashboardStatCard icon={Activity} label="최근 경고 전환" value={summary?.recent_events.length ?? 0} color="bg-indigo-500" />
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-gray-900">최근 인증서 경고</h3>
          <span className="text-xs text-gray-500">만료 임박/만료/복구 전환 표시</span>
        </div>
        {!summary?.recent_events?.length ? (
          <p className="text-sm text-gray-500">최근 인증서 경고 전환이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {summary.recent_events.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {getCertificateEventLabel(event.event)}
                    <span className="ml-2 font-normal text-gray-600">{event.resource_name}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {getCertificateRemainingText(event.days_remaining)}
                    {event.expires_at ? ` · 만료 ${formatDateTime(event.expires_at, timezone)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">{formatDateTime(event.created_at, timezone)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getCertificateEventLabel(event: string) {
  if (event === "certificate_error") return "인증서 만료";
  if (event === "certificate_recovered") return "인증서 복구";
  return "인증서 만료 임박";
}

function getCertificateRemainingText(daysRemaining: number | null) {
  if (daysRemaining === null) return "남은 기간 정보 없음";
  if (daysRemaining < 0) return "이미 만료됨";
  return `${daysRemaining}일 남음`;
}
