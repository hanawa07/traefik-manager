import type { CertificatePreflightSnapshot } from "@/features/certificates/api/certificateApi";

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

export function getPreflightTrend(
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

export function getChangedPreflightItems(
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
