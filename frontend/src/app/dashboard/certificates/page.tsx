"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, History, RefreshCcw, Shield, XCircle } from "lucide-react";

import StatusBadge from "@/shared/components/StatusBadge";
import { useCertificates, useRunCertificateCheck, useRunCertificatePreflight } from "@/features/certificates/hooks/useCertificates";
import type {
  Certificate,
  CertificateAcmeErrorKind,
  CertificatePreflightSnapshot,
} from "@/features/certificates/api/certificateApi";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { useAuditCertificateSummary } from "@/features/audit/hooks/useAudit";
import Modal from "@/shared/components/Modal";

type ChecklistState = "ok" | "pending" | "fail";
type CertificateChecklistItem = {
  label: string;
  state: ChecklistState;
  detail: string;
};

function getAcmeErrorKindLabel(kind: CertificateAcmeErrorKind | null | undefined) {
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
}

function getCertificateChecklist(certificate: Certificate): {
  action: string;
  items: CertificateChecklistItem[];
} {
  const recentFailureLabel = getAcmeErrorKindLabel(certificate.last_acme_error_kind);
  const items: CertificateChecklistItem[] = [
    {
      label: "라우트 감지",
      state: certificate.router_names.length > 0 ? "ok" : "fail",
      detail:
        certificate.router_names.length > 0
          ? `${certificate.router_names.length}개 라우터가 도메인을 처리 중입니다`
          : "이 도메인을 처리하는 Traefik 라우터를 찾지 못했습니다",
    },
    {
      label: "자동 발급 설정",
      state: certificate.cert_resolvers.length > 0 ? "ok" : "fail",
      detail:
        certificate.cert_resolvers.length > 0
          ? `certResolver ${certificate.cert_resolvers.join(", ")} 사용`
          : "certResolver가 없어 Let’s Encrypt 자동 발급이 돌지 않습니다",
    },
    {
      label: "ACME 저장소",
      state: certificate.expires_at ? "ok" : certificate.status === "pending" ? "pending" : "fail",
      detail: certificate.expires_at
        ? "인증서가 ACME 저장소에 기록돼 있습니다"
        : certificate.status === "pending"
          ? "라우터는 준비됐지만 인증서가 아직 저장되지 않았습니다"
          : "저장된 인증서가 없어 기본 인증서 또는 미설정 상태일 수 있습니다",
    },
    {
      label: "최근 발급 실패",
      state: certificate.last_acme_error_message ? "fail" : "ok",
      detail: certificate.last_acme_error_message
        ? `${recentFailureLabel ? `${recentFailureLabel} · ` : ""}${certificate.last_acme_error_message}`
        : "최근 ACME 실패가 기록되지 않았습니다",
    },
  ];

  if (certificate.last_acme_error_kind === "dns") {
    return {
      action: "권한 DNS 응답과 A/AAAA 조회 결과를 먼저 확인하세요.",
      items,
    };
  }

  if (certificate.last_acme_error_kind === "authorization" || certificate.last_acme_error_kind === "challenge") {
    return {
      action: "80/443 공개 상태와 challenge 경로 응답을 먼저 확인하세요.",
      items,
    };
  }

  if (certificate.last_acme_error_kind === "rate_limit") {
    return {
      action: "반복 발급을 멈추고 잠시 뒤 다시 검사하세요.",
      items,
    };
  }

  if (certificate.router_names.length === 0) {
    return {
      action: "도메인 라우트가 실제로 생성됐는지 먼저 확인하세요.",
      items,
    };
  }

  if (certificate.cert_resolvers.length === 0) {
    return {
      action: "TLS 설정과 certResolver 연결부터 확인하세요.",
      items,
    };
  }

  if (certificate.status === "pending") {
    return {
      action: "도메인 요청 후 몇 분 뒤 경고 검사를 다시 실행하세요.",
      items,
    };
  }

  if (certificate.status === "inactive") {
    return {
      action: "자동 발급을 쓰려면 이 도메인 라우트에 certResolver를 붙여야 합니다.",
      items,
    };
  }

  return {
    action: "추가 조치 없이 현재 상태만 모니터링하면 됩니다.",
    items,
  };
}

function ChecklistStateIcon({ state }: { state: ChecklistState }) {
  if (state === "ok") {
    return <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  }
  if (state === "pending") {
    return <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />;
  }
  return <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />;
}

function getPreflightStatusWeight(status: "ok" | "warning" | "error") {
  if (status === "error") return 2;
  if (status === "warning") return 1;
  return 0;
}

function getPreflightStatusLabel(status: "ok" | "warning" | "error") {
  if (status === "error") return "실패";
  if (status === "warning") return "대기";
  return "정상";
}

function getPreflightTrend(
  current: CertificatePreflightSnapshot,
  previous: CertificatePreflightSnapshot,
): { label: string; colorClass: string } {
  const currentWeight = getPreflightStatusWeight(current.overall_status);
  const previousWeight = getPreflightStatusWeight(previous.overall_status);

  if (currentWeight < previousWeight) {
    return {
      label: "직전 검사보다 개선됨",
      colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    };
  }
  if (currentWeight > previousWeight) {
    return {
      label: "직전 검사보다 악화됨",
      colorClass: "text-rose-700 bg-rose-50 border-rose-200",
    };
  }
  return {
    label: "직전 검사와 같은 단계",
    colorClass: "text-gray-700 bg-gray-50 border-gray-200",
  };
}

function getChangedPreflightItems(
  current: CertificatePreflightSnapshot,
  previous: CertificatePreflightSnapshot,
) {
  const previousItems = new Map(previous.items.map((item) => [item.key, item]));
  return current.items
    .map((item) => {
      const previousItem = previousItems.get(item.key);
      if (!previousItem) {
        return {
          key: item.key,
          label: item.label,
          summary: "이 항목이 새로 추가되었습니다.",
        };
      }
      if (previousItem.status === item.status && previousItem.detail === item.detail) {
        return null;
      }
      return {
        key: item.key,
        label: item.label,
        summary:
          previousItem.status !== item.status
            ? `${getPreflightStatusLabel(previousItem.status)} -> ${getPreflightStatusLabel(item.status)}`
            : "상세 메시지가 변경되었습니다.",
        previousDetail: previousItem.detail,
        currentDetail: item.detail,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

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
  const runCertificatePreflight = useRunCertificatePreflight();
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const { data: certificateSummary } = useAuditCertificateSummary({ recent_limit: 5 });
  const [preflightDomain, setPreflightDomain] = useState<string | null>(null);

  const warningCount = certificates.filter((item) => item.status === "warning").length;
  const errorCount = certificates.filter((item) => item.status === "error").length;
  const pendingCount = certificates.filter((item) => item.status === "pending").length;
  const recentFailureCount = certificates.filter((item) => item.last_acme_error_message).length;

  const openPreflight = (domain: string) => {
    setPreflightDomain(domain);
    runCertificatePreflight.mutate(domain);
  };

  const closePreflight = () => {
    setPreflightDomain(null);
    runCertificatePreflight.reset();
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
          <h2 className="text-base font-semibold text-gray-900">발급 체크리스트 기준</h2>
          <p className="mt-1 text-xs text-gray-500">
            각 인증서 행은 같은 4단계 체크리스트로 읽습니다. 초록은 정상, 파랑은 대기, 빨강은 바로 확인해야 할 항목입니다.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-medium text-gray-900">1. 라우트 감지</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Traefik이 이 도메인을 처리하는 라우터를 실제로 읽고 있는지 확인합니다.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-medium text-gray-900">2. 자동 발급 설정</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              TLS만 켜져 있어도 충분하지 않습니다. certResolver가 있어야 ACME가 발급을 시도합니다.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-medium text-gray-900">3. ACME 저장소</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              인증서가 실제로 저장됐는지, 아직 대기 중인지, 아예 없는지를 구분합니다.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-medium text-gray-900">4. 최근 실패 사유</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              DNS timeout, challenge 실패, rate limit 같은 마지막 ACME 실패 원인을 바로 보여줍니다.
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
                    {(() => {
                      const checklist = getCertificateChecklist(certificate);
                      return (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                            <p className="text-[11px] font-medium text-blue-800">다음 조치</p>
                            <p className="mt-1 text-[11px] leading-5 text-blue-700">{checklist.action}</p>
                          </div>
                          <div className="space-y-1.5">
                            {checklist.items.map((item) => (
                              <div
                                key={item.label}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] leading-5"
                              >
                                <div className="flex items-start gap-2">
                                  <ChecklistStateIcon state={item.state} />
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900">{item.label}</p>
                                    <p className="mt-0.5 break-words text-gray-600">{item.detail}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {certificate.last_acme_error_at ? (
                              <p className="px-1 text-[10px] text-gray-500">
                                마지막 실패 {formatDateTime(certificate.last_acme_error_at, timeDisplaySettings?.display_timezone)}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => openPreflight(certificate.domain)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            사전 진단
                          </button>
                        </div>
                      );
                    })()}
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

      <Modal
        isOpen={!!preflightDomain}
        onClose={closePreflight}
        title={preflightDomain ? `발급 사전 진단 · ${preflightDomain}` : "발급 사전 진단"}
      >
        {runCertificatePreflight.isPending ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">진단을 실행하는 중입니다</p>
            <p className="text-xs leading-5 text-gray-500">공개 DNS, HTTP challenge 경로, 현재 제공 인증서를 순서대로 확인합니다.</p>
          </div>
        ) : runCertificatePreflight.isError ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-red-700">사전 진단을 실행하지 못했습니다</p>
            <p className="text-xs leading-5 text-red-600">
              {(runCertificatePreflight.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                "잠시 후 다시 시도해 주세요"}
            </p>
          </div>
        ) : runCertificatePreflight.data && preflightDomain ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={runCertificatePreflight.data.overall_status === "ok" ? "active" : runCertificatePreflight.data.overall_status === "warning" ? "warning" : "error"} />
                <p className="text-sm font-medium text-blue-900">다음 조치</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-blue-800">{runCertificatePreflight.data.recommendation}</p>
              <p className="mt-2 text-[11px] text-blue-700">
                검사 시각 {formatDateTime(runCertificatePreflight.data.checked_at, timeDisplaySettings?.display_timezone)}
              </p>
            </div>

            {runCertificatePreflight.data.previous_result ? (
              (() => {
                const previousResult = runCertificatePreflight.data.previous_result;
                const trend = getPreflightTrend(runCertificatePreflight.data, previousResult);
                const changedItems = getChangedPreflightItems(runCertificatePreflight.data, previousResult);
                return (
                  <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">직전 검사 대비</p>
                        <p className="mt-1 text-xs text-gray-500">
                          이전 검사 {formatDateTime(previousResult.checked_at, timeDisplaySettings?.display_timezone)}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${trend.colorClass}`}>
                        {trend.label}
                      </span>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      <p className="font-medium text-gray-900">이전 권장 조치</p>
                      <p className="mt-1 leading-5">{previousResult.recommendation}</p>
                    </div>
                    {changedItems.length > 0 ? (
                      <div className="space-y-2">
                        {changedItems.map((item) => (
                          <div key={item.key} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-gray-900">{item.label}</p>
                              <span className="text-[11px] text-gray-500">{item.summary}</span>
                            </div>
                            {item.previousDetail ? (
                              <p className="mt-2 text-[11px] leading-5 text-gray-500">이전: {item.previousDetail}</p>
                            ) : null}
                            {"currentDetail" in item ? (
                              <p className="mt-1 text-[11px] leading-5 text-gray-700">현재: {item.currentDetail}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-600">
                        직전 검사와 비교해 상태 변화가 없습니다.
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-500">
                저장된 이전 사전 진단 결과가 없습니다. 이번 검사부터 이력이 쌓입니다.
              </div>
            )}

            <div className="space-y-2">
              {runCertificatePreflight.data.items.map((item) => (
                <div key={item.key} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <ChecklistStateIcon state={item.status === "ok" ? "ok" : item.status === "warning" ? "pending" : "fail"} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-600">{item.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
