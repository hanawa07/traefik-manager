import { Loader2 } from "lucide-react";

import type {
  CertificatePreflightResult,
  CertificatePreflightSnapshot,
} from "@/features/certificates/api/certificateApi";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import {
  ChecklistStateIcon,
  getCertificateErrorDetail,
  getChangedPreflightItems,
  getPreflightTrend,
} from "./certificatePageHelpers";

interface CertificatePreflightSectionProps {
  preflight: CertificatePreflightResult | null;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  timezone?: string;
}

export default function CertificatePreflightSection({
  preflight,
  isPending,
  isError,
  error,
  timezone,
}: CertificatePreflightSectionProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">사전 진단 결과</h3>
        <p className="mt-1 text-xs text-gray-500">
          DNS, challenge, 현재 제공 인증서, 최근 발급 실패를 한 번에 점검합니다.
        </p>
      </div>

      {isPending && !preflight ? (
        <PreflightLoading />
      ) : isError ? (
        <PreflightError error={error} />
      ) : preflight ? (
        <PreflightResultPanel preflight={preflight} timezone={timezone} />
      ) : (
        <PreflightEmpty />
      )}
    </section>
  );
}

function PreflightLoading() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        진단을 실행하는 중입니다
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-500">
        공개 DNS, HTTP challenge 경로, 현재 제공 인증서를 순서대로 확인합니다.
      </p>
    </div>
  );
}

function PreflightError({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4">
      <p className="text-sm font-medium text-rose-700">사전 진단을 실행하지 못했습니다</p>
      <p className="mt-1 text-xs leading-5 text-rose-600">
        {getCertificateErrorDetail(error, "잠시 후 다시 시도해 주세요")}
      </p>
    </div>
  );
}

function PreflightEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-500">
      아직 사전 진단 결과가 없습니다. `사전 진단`을 눌러 현재 발급 조건을 즉시 확인하세요.
    </div>
  );
}

function PreflightResultPanel({
  preflight,
  timezone,
}: {
  preflight: CertificatePreflightResult;
  timezone?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <StatusBadge status={getPreflightBadgeStatus(preflight.overall_status)} />
          <p className="text-sm font-medium text-blue-900">다음 조치</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-blue-800">{preflight.recommendation}</p>
        <p className="mt-2 text-[11px] text-blue-700">
          검사 시각 {formatDateTime(preflight.checked_at, timezone)}
        </p>
        {preflight.repeated_failure_active ? (
          <p className="mt-2 text-xs font-medium text-rose-700">
            같은 실패가 {preflight.repeated_failure_streak}회 연속 반복돼 알림 대상으로 기록됐습니다.
          </p>
        ) : null}
      </div>

      {preflight.previous_result ? (
        <PreflightComparison
          current={preflight}
          previous={preflight.previous_result}
          timezone={timezone}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-500">
          저장된 이전 사전 진단 결과가 없습니다. 이번 검사부터 이력이 쌓입니다.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {preflight.items.map((item) => (
          <div key={item.key} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <ChecklistStateIcon
                state={item.status === "ok" ? "ok" : item.status === "warning" ? "pending" : "fail"}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-gray-600">{item.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreflightComparison({
  current,
  previous,
  timezone,
}: {
  current: CertificatePreflightSnapshot;
  previous: CertificatePreflightSnapshot;
  timezone?: string;
}) {
  const trend = getPreflightTrend(current, previous);
  const changedItems = getChangedPreflightItems(current, previous);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">직전 검사 대비</p>
          <p className="mt-1 text-xs text-gray-500">
            이전 검사 {formatDateTime(previous.checked_at, timezone)}
          </p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${trend.colorClass}`}>
          {trend.label}
        </span>
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
}

function getPreflightBadgeStatus(status: CertificatePreflightResult["overall_status"]) {
  if (status === "ok") return "active";
  if (status === "warning") return "warning";
  return "error";
}
