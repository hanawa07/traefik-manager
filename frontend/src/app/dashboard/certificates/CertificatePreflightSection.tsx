import { Loader2 } from "lucide-react";

import type { CertificatePreflightResult } from "@/features/certificates/api/certificateApi";

import { getCertificateErrorDetail } from "./certificatePageHelpers";
import CertificatePreflightResultPanel from "./CertificatePreflightResultPanel";

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
        <CertificatePreflightResultPanel preflight={preflight} timezone={timezone} />
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
