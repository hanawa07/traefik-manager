import type {
  CertificatePreflightSnapshot,
  CertificatePreflightStatus,
} from "@/features/certificates/api/certificateApi";

export type PreflightTrend = {
  label: string;
  colorClass: string;
};

export function getPreflightTrend(
  current: CertificatePreflightSnapshot,
  previous: CertificatePreflightSnapshot,
): PreflightTrend {
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

function getPreflightStatusWeight(status: CertificatePreflightStatus) {
  if (status === "error") return 2;
  if (status === "warning") return 1;
  return 0;
}
