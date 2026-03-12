"use client";
import { AlertTriangle, RefreshCcw, Shield, History } from "lucide-react";

import StatusBadge from "@/shared/components/StatusBadge";
import { useCertificates, useRunCertificateCheck } from "@/features/certificates/hooks/useCertificates";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { useAuditCertificateSummary } from "@/features/audit/hooks/useAudit";

export default function CertificatesPage() {
  const {
    data: certificates = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useCertificates();
  const runCertificateCheck = useRunCertificateCheck();
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const { data: certificateSummary } = useAuditCertificateSummary({ recent_limit: 5 });

  const warningCount = certificates.filter((item) => item.status === "warning").length;
  const errorCount = certificates.filter((item) => item.status === "error").length;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">인증서</h1>
          <p className="text-gray-500 text-sm mt-1">Traefik API 기반 TLS 인증서 상태</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runCertificateCheck.mutate()}
            className="btn-primary flex items-center gap-2"
            disabled={runCertificateCheck.isPending}
          >
            <Shield className="w-4 h-4" />
            {runCertificateCheck.isPending ? "검사 중..." : "경고 검사"}
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-secondary flex items-center gap-2"
            disabled={isFetching}
          >
            <RefreshCcw className="w-4 h-4" />
            {isFetching ? "갱신 중..." : "새로고침"}
          </button>
        </div>
      </div>

      {runCertificateCheck.isSuccess && (
        <div className="card mb-6 border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-700">인증서 경고 재검사를 완료했습니다</p>
          <p className="mt-1 text-xs text-blue-600">
            {formatDateTime(runCertificateCheck.data.checked_at, timeDisplaySettings?.display_timezone)}
            {` · 전체 ${runCertificateCheck.data.total_count}개 · 만료 임박 ${runCertificateCheck.data.warning_count}개 · 만료 ${runCertificateCheck.data.error_count}개 · 신규 경고 ${runCertificateCheck.data.recorded_event_count}건`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-sm text-gray-500">전체 인증서</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{certificates.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">30일 이내 만료</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{warningCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">만료됨</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{errorCount}</p>
        </div>
      </div>

      <div className="card mb-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">최근 상태 전이</h2>
            <p className="mt-1 text-xs text-gray-500">
              최근 {certificateSummary?.window_minutes ?? 43200}분 기준 인증서 경고/복구 이력입니다.
            </p>
          </div>
          <div className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
            복구 {certificateSummary?.recovered_count ?? 0}건
          </div>
        </div>

        {!certificateSummary?.recent_events?.length ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            최근 인증서 상태 전이가 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {certificateSummary.recent_events.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {event.event === "certificate_error"
                      ? "인증서 만료"
                      : event.event === "certificate_recovered"
                        ? "인증서 복구"
                        : "인증서 만료 임박"}
                    <span className="ml-2 font-normal text-gray-600">{event.resource_name}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {event.previous_status ? `이전 상태 ${event.previous_status} · ` : ""}
                    {event.checked_at
                      ? `검사 ${formatDateTime(event.checked_at, timeDisplaySettings?.display_timezone)}`
                      : `기록 ${formatDateTime(event.created_at, timeDisplaySettings?.display_timezone)}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">
                  {formatDateTime(event.created_at, timeDisplaySettings?.display_timezone)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isError && (
        <div className="card p-4 border-red-200 bg-red-50 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">인증서 정보를 가져오지 못했습니다</p>
              <p className="text-xs text-red-600 mt-1">
                {(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                  "잠시 후 다시 시도해 주세요"}
              </p>
            </div>
          </div>
        </div>
      )}

      {runCertificateCheck.isError && (
        <div className="card p-4 border-red-200 bg-red-50 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">인증서 경고 재검사에 실패했습니다</p>
              <p className="text-xs text-red-600 mt-1">
                {(runCertificateCheck.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                  "잠시 후 다시 시도해 주세요"}
              </p>
            </div>
          </div>
        </div>
      )}

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
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium">도메인</th>
                <th className="px-6 py-3 text-left font-medium">만료일</th>
                <th className="px-6 py-3 text-left font-medium">남은 기간</th>
                <th className="px-6 py-3 text-left font-medium">상태</th>
                <th className="px-6 py-3 text-left font-medium">라우터</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {certificates.map((certificate) => (
                <tr key={certificate.domain} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{certificate.domain}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {formatDateTime(certificate.expires_at, timeDisplaySettings?.display_timezone)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {certificate.days_remaining === null
                      ? "-"
                      : certificate.days_remaining < 0
                        ? "만료됨"
                        : `${certificate.days_remaining}일`}
                  </td>
                  <td className="px-6 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={certificate.status} />
                        <span className="text-xs text-gray-500">{certificate.status_message}</span>
                      </div>
                      {certificate.alerts_suppressed ? (
                        <div className="flex items-center gap-1 text-[11px] text-amber-700">
                          <History className="h-3 w-3" />
                          <span>
                            중복 경고 억제 중
                            {certificate.status_started_at
                              ? ` · 상태 시작 ${formatDateTime(certificate.status_started_at, timeDisplaySettings?.display_timezone)}`
                              : ""}
                          </span>
                        </div>
                      ) : certificate.status_started_at ? (
                        <p className="text-[11px] text-gray-500">
                          상태 시작 {formatDateTime(certificate.status_started_at, timeDisplaySettings?.display_timezone)}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {certificate.router_names.length > 0 ? certificate.router_names.join(", ") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
