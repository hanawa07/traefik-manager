import type { Service } from "@/features/services/api/serviceApi";

import type { GeneratedMiddlewareItem } from "./middlewarePageHelpers";

export type GeneratedStatusFilter = "all" | "attention" | "pending";

export interface GeneratedMiddlewareServiceGroup {
  service: Service;
  items: GeneratedMiddlewareItem[];
}

export function isGeneratedStatusFilter(value: string | null): value is GeneratedStatusFilter {
  return value === "attention" || value === "pending" || value === "all";
}

export function countGeneratedMiddlewareStatuses(
  groups: Array<{ items: GeneratedMiddlewareItem[] }>,
) {
  return groups.reduce(
    (counts, group) => {
      counts.all += group.items.length;
      counts.attention += group.items.filter(isAttentionItem).length;
      counts.pending += group.items.filter((item) => item.status === "pending").length;
      return counts;
    },
    { all: 0, attention: 0, pending: 0 },
  );
}

export function filterGeneratedServiceGroups(
  groups: GeneratedMiddlewareServiceGroup[],
  statusFilter: GeneratedStatusFilter,
) {
  if (statusFilter === "all") return groups;
  return groups
    .map(({ service, items }) => ({
      service,
      items: items.filter((item) =>
        statusFilter === "pending" ? item.status === "pending" : isAttentionItem(item),
      ),
    }))
    .filter(({ items }) => items.length > 0);
}

export function getGeneratedMiddlewareEmptyState({
  generatedSearch,
  statusFilter,
  totalItems,
}: {
  generatedSearch: string;
  statusFilter: GeneratedStatusFilter;
  totalItems: number;
}) {
  if (totalItems === 0) {
    if (generatedSearch.trim()) {
      return {
        title: "검색 조건과 일치하는 자동 생성 미들웨어가 없습니다",
        description: "서비스 이름이나 도메인 검색어를 줄여 다시 확인하세요.",
      };
    }

    return {
      title: "아직 자동 생성 미들웨어가 없습니다",
      description:
        "허용 IP, 서비스 Rate Limit, 프레임 정책, Basic Auth, HTTPS 리다이렉트 같은 서비스 옵션을 켜면 여기에 표시됩니다.",
    };
  }

  if (statusFilter === "attention") {
    return {
      title: "미적용 또는 오류 상태의 자동 생성 미들웨어가 없습니다",
      description: "현재 검색 범위의 자동 생성 미들웨어가 모두 적용됐거나 대기 상태입니다.",
    };
  }

  if (statusFilter === "pending") {
    return {
      title: "대기 중인 자동 생성 미들웨어가 없습니다",
      description: "Traefik 런타임 확인이 끝났거나 현재 검색 범위에 대기 항목이 없습니다.",
    };
  }

  return {
    title: "조건에 맞는 자동 생성 미들웨어가 없습니다",
    description: "검색어나 상태 필터를 조정해 다시 확인하세요.",
  };
}

function isAttentionItem(item: GeneratedMiddlewareItem) {
  return item.status !== "active" && item.status !== "pending";
}
