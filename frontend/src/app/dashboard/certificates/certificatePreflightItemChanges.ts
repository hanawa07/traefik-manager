import type {
  CertificatePreflightItem,
  CertificatePreflightSnapshot,
  CertificatePreflightStatus,
} from "@/features/certificates/api/certificateApi";

export type ChangedPreflightItem = {
  key: CertificatePreflightItem["key"];
  label: string;
  summary: string;
  previousDetail?: string;
  currentDetail?: string;
};

export function getChangedPreflightItems(
  current: CertificatePreflightSnapshot,
  previous: CertificatePreflightSnapshot,
): ChangedPreflightItem[] {
  const previousItems = new Map(previous.items.map((item) => [item.key, item]));
  const changedItems: ChangedPreflightItem[] = [];

  for (const item of current.items) {
    const previousItem = previousItems.get(item.key);
    if (!previousItem) {
      changedItems.push({
        key: item.key,
        label: item.label,
        summary: "이 항목이 새로 추가되었습니다.",
      });
      continue;
    }

    if (previousItem.status === item.status && previousItem.detail === item.detail) {
      continue;
    }

    changedItems.push({
      key: item.key,
      label: item.label,
      summary:
        previousItem.status !== item.status
          ? `${getPreflightStatusLabel(previousItem.status)} -> ${getPreflightStatusLabel(item.status)}`
          : "상세 메시지가 변경되었습니다.",
      previousDetail: previousItem.detail,
      currentDetail: item.detail,
    });
  }

  return changedItems;
}

function getPreflightStatusLabel(status: CertificatePreflightStatus) {
  if (status === "error") return "실패";
  if (status === "warning") return "대기";
  return "정상";
}
