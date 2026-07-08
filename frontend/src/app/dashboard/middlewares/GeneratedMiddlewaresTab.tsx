"use client";

import { useState } from "react";

import type { Service } from "@/features/services/api/serviceApi";

import { GeneratedMiddlewaresHeader } from "./GeneratedMiddlewaresHeader";
import { GeneratedMiddlewareServiceCard } from "./GeneratedMiddlewareServiceCard";
import {
  GeneratedMiddlewaresStatusPanels,
  GeneratedRuntimeBanner,
} from "./GeneratedMiddlewaresStatusPanels";
import { type GeneratedMiddlewareItem } from "./middlewarePageHelpers";

type GeneratedStatusFilter = "all" | "attention" | "pending";

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
  const filterCounts = buildFilterCounts(generatedServiceGroups);
  const visibleServiceGroups = filterGeneratedServiceGroups(generatedServiceGroups, statusFilter);
  const shouldShowGroups =
    !isServicesLoading && !isRuntimeLoading && !isServicesError && visibleServiceGroups.length > 0;

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
