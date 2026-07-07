import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { clsx } from "clsx";

import type { ServiceGatewayDiagnosis } from "../api/serviceApi";

interface ServiceCardDiagnosisBadgeProps {
  diagnosis?: ServiceGatewayDiagnosis | null;
}

export function ServiceCardDiagnosisBadge({ diagnosis }: ServiceCardDiagnosisBadgeProps) {
  if (!diagnosis) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        diagnosis.status === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : diagnosis.status === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-rose-200 bg-rose-50 text-rose-700",
      )}
      title={diagnosis.summary}
    >
      <DiagnosisIcon status={diagnosis.status} />
      최근 진단 {getStatusLabel(diagnosis.status)}
    </span>
  );
}

function DiagnosisIcon({ status }: { status: string }) {
  const className = "h-3 w-3";
  if (status === "ok") return <CheckCircle2 className={`${className} text-emerald-500`} />;
  if (status === "warning") return <AlertTriangle className={`${className} text-amber-500`} />;
  return <XCircle className={`${className} text-rose-500`} />;
}

function getStatusLabel(status: string) {
  if (status === "ok") return "정상";
  if (status === "warning") return "확인 필요";
  return "문제 있음";
}
