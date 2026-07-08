"use client";

import { useEffect, useState } from "react";

import type { Service } from "@/features/services/api/serviceApi";

import { GeneratedMiddlewaresHeader } from "./GeneratedMiddlewaresHeader";
import { GeneratedMiddlewareServiceCard } from "./GeneratedMiddlewareServiceCard";
import {
  GeneratedMiddlewaresStatusPanels,
  GeneratedRuntimeBanner,
} from "./GeneratedMiddlewaresStatusPanels";
import { type GeneratedMiddlewareItem } from "./middlewarePageHelpers";

type GeneratedStatusFilter = "all" | "attention" | "pending";

function isGeneratedStatusFilter(value: string | null): value is GeneratedStatusFilter {
  return value === "attention" || value === "pending" || value === "all";
}

function readStatusFilterFromUrl(): GeneratedStatusFilter {
  if (typeof window === "undefined") {
    return "all";
  }

  const status = new URLSearchParams(window.location.search).get("status");
  return isGeneratedStatusFilter(status) ? status : "all";
}

function replaceStatusFilterInUrl(statusFilter: GeneratedStatusFilter) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (statusFilter === "all") {
    url.searchParams.delete("status");
  } else {
    url.searchParams.set("status", statusFilter);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

interface GeneratedMiddlewaresTabProps {
  generatedSearch: string;
  onGeneratedSearchChange: (value: string) => void;
  runtimeBannerMessage: string | null;
  isServicesLoading: boolean;
  isRuntimeLoading: boolean;
  isServicesError: boolean;
  servicesError: unknown;
  generatedServiceCount: number;
  generatedServiceGroups: Array<{
    service: Service;
    items: GeneratedMiddlewareItem[];
  }>;
}

export default function GeneratedMiddlewaresTab({
  generatedSearch,
  onGeneratedSearchChange,
  runtimeBannerMessage,
  isServicesLoading,
  isRuntimeLoading,
  isServicesError,
  servicesError,
  generatedServiceCount,
  generatedServiceGroups,
}: GeneratedMiddlewaresTabProps) {
  const [statusFilter, setStatusFilter] = useState<GeneratedStatusFilter>("all");
  const [isUrlReady, setIsUrlReady] = useState(false);
  const filterCounts = buildFilterCounts(generatedServiceGroups);
  const emptyState = getGeneratedEmptyState({
    generatedSearch,
    statusFilter,
    totalItems: filterCounts.all,
  });
  const visibleServiceGroups = filterGeneratedServiceGroups(generatedServiceGroups, statusFilter);
  const shouldShowGroups =
    !isServicesLoading && !isRuntimeLoading && !isServicesError && visibleServiceGroups.length > 0;

  useEffect(() => {
    function applyStatusFilterFromUrl() {
      setStatusFilter(readStatusFilterFromUrl());
    }

    applyStatusFilterFromUrl();
    setIsUrlReady(true);
    window.addEventListener("popstate", applyStatusFilterFromUrl);

    return () => window.removeEventListener("popstate", applyStatusFilterFromUrl);
  }, []);

  useEffect(() => {
    if (!isUrlReady) {
      return;
    }

    replaceStatusFilterInUrl(statusFilter);
  }, [isUrlReady, statusFilter]);

  return (
    <div className="space-y-4">
      <GeneratedMiddlewaresHeader
        generatedSearch={generatedSearch}
        onGeneratedSearchChange={onGeneratedSearchChange}
      />
      <div className="flex flex-wrap gap-2">
        <StatusFilterButton
          active={statusFilter === "all"}
          count={filterCounts.all}
          label="전체"
          onClick={() => setStatusFilter("all")}
        />
        <StatusFilterButton
          active={statusFilter === "attention"}
          count={filterCounts.attention}
          label="미적용/오류"
          onClick={() => setStatusFilter("attention")}
        />
        <StatusFilterButton
          active={statusFilter === "pending"}
          count={filterCounts.pending}
          label="대기"
          onClick={() => setStatusFilter("pending")}
        />
      </div>

      <GeneratedRuntimeBanner runtimeBannerMessage={runtimeBannerMessage} />
      <GeneratedMiddlewaresStatusPanels
        emptyDescription={emptyState.description}
        emptyTitle={emptyState.title}
        generatedServiceCount={generatedServiceCount === 0 ? 0 : visibleServiceGroups.length}
        isRuntimeLoading={isRuntimeLoading}
        isServicesError={isServicesError}
        isServicesLoading={isServicesLoading}
        servicesError={servicesError}
      />

      {shouldShowGroups ? (
        <div className="space-y-4">
          {visibleServiceGroups.map(({ service, items }) => (
            <GeneratedMiddlewareServiceCard key={service.id} service={service} items={items} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusFilterButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
        (active
          ? "border-blue-200 bg-blue-600 text-white shadow-sm"
          : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-700")
      }
      type="button"
      onClick={onClick}
    >
      {label} <span className={active ? "text-blue-100" : "text-gray-400"}>{count}</span>
    </button>
  );
}

function buildFilterCounts(groups: Array<{ items: GeneratedMiddlewareItem[] }>) {
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

function filterGeneratedServiceGroups(
  groups: Array<{ service: Service; items: GeneratedMiddlewareItem[] }>,
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

function isAttentionItem(item: GeneratedMiddlewareItem) {
  return item.status !== "active" && item.status !== "pending";
}

function getGeneratedEmptyState({
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
