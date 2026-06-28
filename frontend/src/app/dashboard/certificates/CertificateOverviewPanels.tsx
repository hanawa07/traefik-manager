import type { AuditCertificateSummary } from "@/features/audit/api/auditApi";
import type { CertificateCheckResult } from "@/features/certificates/api/certificateApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";

interface CertificateOverviewPanelsProps {
  checkResult: CertificateCheckResult | null;
  totalCount: number;
  pendingCount: number;
  warningCount: number;
  errorCount: number;
  recentFailureCount: number;
  repeatedFailureCount: number;
  certificateSummary: AuditCertificateSummary | undefined;
  timezone: string | undefined;
}

export default function CertificateOverviewPanels({
  checkResult,
  totalCount,
  pendingCount,
  warningCount,
  errorCount,
  recentFailureCount,
  repeatedFailureCount,
  certificateSummary,
  timezone,
}: CertificateOverviewPanelsProps) {
  return (
    <>
      {checkResult && (
        <div className="card mb-6 border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-700">인증서 경고 재검사를 완료했습니다</p>
          <p className="mt-1 text-xs text-blue-600">
            {formatDateTime(checkResult.checked_at, timezone)}
            {` · 전체 ${checkResult.total_count}개 · 만료 임박 ${checkResult.warning_count}개 · 만료 ${checkResult.error_count}개 · 신규 경고 ${checkResult.recorded_event_count}건`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-sm text-gray-500">전체 인증서</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalCount}</p>
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
          <p className="mt-1 text-xs text-gray-400">반복 실패 {repeatedFailureCount}개</p>
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
              최근 {formatDurationMinutes(certificateSummary?.window_minutes ?? 43200)} 기준 인증서 경고/복구 이력입니다.
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
                      ? `검사 ${formatDateTime(event.checked_at, timezone)}`
                      : `기록 ${formatDateTime(event.created_at, timezone)}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">
                  {formatDateTime(event.created_at, timezone)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
