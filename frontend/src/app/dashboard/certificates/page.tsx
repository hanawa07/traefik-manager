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
  const pendingCount = certificates.filter((item) => item.status === "pending").length;
  const recentFailureCount = certificates.filter((item) => item.last_acme_error_message).length;

  const getAcmeErrorKindLabel = (kind: string | null | undefined) => {
    switch (kind) {
      case "dns":
        return "DNS 검증";
      case "rate_limit":
        return "발급 제한";
      case "authorization":
        return "도메인 인증";
      case "challenge":
        return "챌린지";
      case "unknown":
        return "발급 실패";
      default:
        return null;
    }
  };

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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-sm text-gray-500">전체 인증서</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{certificates.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">발급 대기</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{pendingCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">30일 이내 만료</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{warningCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">만료됨</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{errorCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">최근 발급 실패</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{recentFailureCount}</p>
        </div>
      </div>

      <div className="card mb-6 p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">발급 진단 기준</h2>
          <p className="mt-1 text-xs text-gray-500">
            각 인증서 행에서 라우터 감지, certResolver 설정, ACME 저장 여부, 최근 실패 사유를 함께 봅니다.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-medium text-gray-900">발급 대기</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              certResolver는 있지만 ACME 저장소에 아직 인증서가 없습니다. 최근 실패 사유가 보이면 먼저 그 원인을 봐야 합니다.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-medium text-gray-900">자동 발급 미설정</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              TLS는 켜져 있지만 certResolver가 없습니다. 이 상태에선 Let&apos;s Encrypt 자동 발급이 돌지 않습니다.
            </p>
          </div>
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
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px]">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium">도메인</th>
                <th className="px-6 py-3 text-left font-medium">만료일</th>
                <th className="px-6 py-3 text-left font-medium">남은 기간</th>
                <th className="px-6 py-3 text-left font-medium">상태</th>
                <th className="px-6 py-3 text-left font-medium">발급 방식</th>
                <th className="px-6 py-3 text-left font-medium">발급 진단</th>
                <th className="px-6 py-3 text-left font-medium">라우터</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {certificates.map((certificate) => (
                <tr key={certificate.domain} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{certificate.domain}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {certificate.expires_at
                      ? formatDateTime(certificate.expires_at, timeDisplaySettings?.display_timezone)
                      : "-"}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {certificate.days_remaining === null
                      ? certificate.status === "pending"
                        ? "발급 전"
                        : certificate.status === "inactive"
                          ? "자동 발급 안 함"
                          : "-"
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
                    {certificate.cert_resolvers.length > 0
                      ? `자동 발급 (${certificate.cert_resolvers.join(", ")})`
                      : "수동/미설정"}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-600">
                        라우터 감지:{" "}
                        <span className={certificate.router_names.length > 0 ? "text-emerald-700" : "text-rose-700"}>
                          {certificate.router_names.length > 0 ? "완료" : "없음"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-600">
                        certResolver:{" "}
                        <span className={certificate.cert_resolvers.length > 0 ? "text-emerald-700" : "text-rose-700"}>
                          {certificate.cert_resolvers.length > 0 ? "설정됨" : "없음"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-600">
                        ACME 저장:{" "}
                        <span className={certificate.expires_at ? "text-emerald-700" : "text-amber-700"}>
                          {certificate.expires_at ? "완료" : "없음"}
                        </span>
                      </p>
                      {certificate.last_acme_error_message ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-5 text-amber-800">
                          <p className="font-medium">
                            최근 실패
                            {getAcmeErrorKindLabel(certificate.last_acme_error_kind)
                              ? ` · ${getAcmeErrorKindLabel(certificate.last_acme_error_kind)}`
                              : ""}
                          </p>
                          <p className="mt-0.5 break-words">{certificate.last_acme_error_message}</p>
                          {certificate.last_acme_error_at ? (
                            <p className="mt-1 text-[10px] text-amber-700">
                              {formatDateTime(certificate.last_acme_error_at, timeDisplaySettings?.display_timezone)}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">최근 ACME 실패 없음</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {certificate.router_names.length > 0 ? certificate.router_names.join(", ") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
