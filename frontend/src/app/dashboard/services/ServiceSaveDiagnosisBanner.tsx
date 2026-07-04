import { AlertTriangle, CheckCircle2, Stethoscope, XCircle } from "lucide-react";
import Link from "next/link";

import type { ServiceSaveDiagnosisNotice } from "./serviceSaveDiagnosis";

interface ServiceSaveDiagnosisBannerProps {
  notice: ServiceSaveDiagnosisNotice;
  onClose: () => void;
}

export function ServiceSaveDiagnosisBanner({ notice, onClose }: ServiceSaveDiagnosisBannerProps) {
  const diagnosis = notice.diagnosis;
  const status = notice.error ? "warning" : diagnosis?.status ?? "warning";

  return (
    <div className={getBannerClassName(status)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusIcon status={status} />
            <h2 className="text-sm font-semibold text-gray-900">
              서비스 {notice.action === "created" ? "추가" : "수정"} 후 자동 게이트웨이 진단
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-700">
            {notice.domain}: {notice.error ?? diagnosis?.summary ?? "진단 결과가 없습니다."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/dashboard/services/${notice.serviceId}`}
            className="rounded-lg border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700"
          >
            서비스 설정 열기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            닫기
          </button>
        </div>
      </div>
      {diagnosis ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {diagnosis.checks.map((check) => (
            <div key={check.key} className="rounded-lg bg-white/75 px-3 py-2 text-xs">
              <div className="flex items-start gap-2">
                <StatusIcon status={check.status} compact />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{check.label}</p>
                  <p className="mt-0.5 break-words text-slate-600">{check.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusIcon({ compact = false, status }: { compact?: boolean; status: string }) {
  const className = compact ? "mt-0.5 h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0";
  if (status === "ok") return <CheckCircle2 className={`${className} text-emerald-600`} />;
  if (status === "warning") return <AlertTriangle className={`${className} text-amber-600`} />;
  if (status === "fail") return <XCircle className={`${className} text-rose-600`} />;
  return <Stethoscope className={`${className} text-slate-600`} />;
}

function getBannerClassName(status: string) {
  const base = "mb-5 rounded-2xl border p-4 shadow-sm";
  if (status === "ok") return `${base} border-emerald-200 bg-emerald-50`;
  if (status === "fail") return `${base} border-rose-200 bg-rose-50`;
  return `${base} border-amber-200 bg-amber-50`;
}
