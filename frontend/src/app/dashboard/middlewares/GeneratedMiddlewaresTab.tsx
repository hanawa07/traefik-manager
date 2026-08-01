"use client";

import {
  countGeneratedMiddlewareStatuses,
  filterGeneratedServiceGroups,
  getGeneratedMiddlewareEmptyState,
  type GeneratedMiddlewareServiceGroup,
  type GeneratedStatusFilter,
} from "./generatedMiddlewareFilters";
import { GeneratedMiddlewaresHeader } from "./GeneratedMiddlewaresHeader";
import { GeneratedMiddlewareServiceCard } from "./GeneratedMiddlewareServiceCard";
import {
  GeneratedMiddlewaresStatusPanels,
  GeneratedRuntimeBanner,
} from "./GeneratedMiddlewaresStatusPanels";

interface GeneratedMiddlewaresTabProps {
  generatedSearch: string;
  generatedStatusFilter: GeneratedStatusFilter;
  onGeneratedSearchChange: (value: string) => void;
  onGeneratedStatusFilterChange: (value: GeneratedStatusFilter) => void;
  runtimeBannerMessage: string | null;
  isServicesLoading: boolean;
  isRuntimeLoading: boolean;
  isServicesError: boolean;
  servicesError: unknown;
  generatedServiceCount: number;
  generatedServiceGroups: GeneratedMiddlewareServiceGroup[];
}

export default function GeneratedMiddlewaresTab({
  generatedSearch,
  generatedStatusFilter,
  onGeneratedSearchChange,
  onGeneratedStatusFilterChange,
  runtimeBannerMessage,
  isServicesLoading,
  isRuntimeLoading,
  isServicesError,
  servicesError,
  generatedServiceCount,
  generatedServiceGroups,
}: GeneratedMiddlewaresTabProps) {
  const filterCounts = countGeneratedMiddlewareStatuses(generatedServiceGroups);
  const emptyState = getGeneratedMiddlewareEmptyState({
    generatedSearch,
    statusFilter: generatedStatusFilter,
    totalItems: filterCounts.all,
  });
  const visibleServiceGroups = filterGeneratedServiceGroups(
    generatedServiceGroups,
    generatedStatusFilter,
  );
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
          active={generatedStatusFilter === "all"}
          count={filterCounts.all}
          label="전체"
          onClick={() => onGeneratedStatusFilterChange("all")}
        />
        <StatusFilterButton
          active={generatedStatusFilter === "attention"}
          count={filterCounts.attention}
          label="미적용/오류"
          onClick={() => onGeneratedStatusFilterChange("attention")}
        />
        <StatusFilterButton
          active={generatedStatusFilter === "pending"}
          count={filterCounts.pending}
          label="대기"
          onClick={() => onGeneratedStatusFilterChange("pending")}
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
          ? "border-blue-200 bg-blue-600 text-white shadow-sm dark:border-blue-500 dark:bg-blue-500"
          : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300")
      }
      type="button"
      onClick={onClick}
    >
      {label} <span className={active ? "text-blue-100" : "text-gray-400 dark:text-slate-500"}>{count}</span>
    </button>
  );
}
