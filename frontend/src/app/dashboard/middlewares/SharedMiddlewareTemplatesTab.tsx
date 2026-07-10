import { Search } from "lucide-react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareItem } from "@/features/traefik/api/traefikApi";

import SharedMiddlewareTemplateList from "./SharedMiddlewareTemplateList";
import {
  SharedMiddlewareFilteredEmptyState,
  RuntimeStatusBanner,
  SharedMiddlewareEmptyState,
  SharedMiddlewareErrorState,
  SharedMiddlewareLoadingState,
} from "./SharedMiddlewareTemplatesStatusPanels";
import type { TemplateStatusFilter } from "./middlewareTemplateFilters";

interface SharedMiddlewareTemplatesTabProps {
  canManage: boolean;
  runtimeConnected: boolean;
  runtimeBannerMessage: string | null;
  isTemplateLoading: boolean;
  isServicesLoading: boolean;
  sharedTabBlocked: boolean;
  sharedTabErrorMessage: string;
  templateFilterCounts: {
    all: number;
    active: number;
    inactive: number;
    attention: number;
  };
  templateSearch: string;
  templateStatusFilter: TemplateStatusFilter;
  templatesCount: number;
  visibleTemplates: MiddlewareTemplate[];
  appliedServicesByTemplate: Record<string, Service[]>;
  runtimeMap: Map<string, TraefikMiddlewareItem>;
  onTemplateSearchChange: (value: string) => void;
  onTemplateStatusFilterChange: (value: TemplateStatusFilter) => void;
  onCreateOpen: () => void;
  onEdit: (template: MiddlewareTemplate) => void;
  onDelete: (template: MiddlewareTemplate) => void;
  onAssign: (template: MiddlewareTemplate) => void;
}

export default function SharedMiddlewareTemplatesTab({
  canManage,
  runtimeConnected,
  runtimeBannerMessage,
  isTemplateLoading,
  isServicesLoading,
  sharedTabBlocked,
  sharedTabErrorMessage,
  templateFilterCounts,
  templateSearch,
  templateStatusFilter,
  templatesCount,
  visibleTemplates,
  appliedServicesByTemplate,
  runtimeMap,
  onTemplateSearchChange,
  onTemplateStatusFilterChange,
  onCreateOpen,
  onEdit,
  onDelete,
  onAssign,
}: SharedMiddlewareTemplatesTabProps) {
  const resetFilters = () => {
    onTemplateSearchChange("");
    onTemplateStatusFilterChange("all");
  };

  return (
    <div className="space-y-4">
      <RuntimeStatusBanner message={runtimeBannerMessage} />

      {isTemplateLoading || isServicesLoading ? (
        <SharedMiddlewareLoadingState />
      ) : sharedTabBlocked ? (
        <SharedMiddlewareErrorState message={sharedTabErrorMessage} />
      ) : templatesCount === 0 ? (
        <SharedMiddlewareEmptyState canManage={canManage} onCreateOpen={onCreateOpen} />
      ) : (
        <>
          <SharedMiddlewareTemplateFilters
            counts={templateFilterCounts}
            search={templateSearch}
            statusFilter={templateStatusFilter}
            onReset={resetFilters}
            onSearchChange={onTemplateSearchChange}
            onStatusFilterChange={onTemplateStatusFilterChange}
          />
          {visibleTemplates.length === 0 ? (
            <SharedMiddlewareFilteredEmptyState onReset={resetFilters} />
          ) : (
            <SharedMiddlewareTemplateList
              canManage={canManage}
              runtimeConnected={runtimeConnected}
              templates={visibleTemplates}
              appliedServicesByTemplate={appliedServicesByTemplate}
              runtimeMap={runtimeMap}
              onEdit={onEdit}
              onDelete={onDelete}
              onAssign={onAssign}
            />
          )}
        </>
      )}
    </div>
  );
}

function SharedMiddlewareTemplateFilters({
  counts,
  search,
  statusFilter,
  onReset,
  onSearchChange,
  onStatusFilterChange,
}: {
  counts: {
    all: number;
    active: number;
    inactive: number;
    attention: number;
  };
  search: string;
  statusFilter: TemplateStatusFilter;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: TemplateStatusFilter) => void;
}) {
  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">공유 미들웨어 템플릿</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            이름, 공유 이름, 타입, 설정, 적용된 서비스 기준으로 검색합니다.
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className={
              "w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 " +
              "outline-none transition-colors focus:border-blue-400 " +
              "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            }
            placeholder="템플릿, 타입, 서비스 검색"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TemplateFilterButton
          active={statusFilter === "all"}
          count={counts.all}
          label="전체"
          onClick={() => onStatusFilterChange("all")}
        />
        <TemplateFilterButton
          active={statusFilter === "active"}
          count={counts.active}
          label="적용 중"
          onClick={() => onStatusFilterChange("active")}
        />
        <TemplateFilterButton
          active={statusFilter === "inactive"}
          count={counts.inactive}
          label="미적용"
          onClick={() => onStatusFilterChange("inactive")}
        />
        <TemplateFilterButton
          active={statusFilter === "attention"}
          count={counts.attention}
          label="확인 필요"
          onClick={() => onStatusFilterChange("attention")}
        />
        {hasActiveFilters ? (
          <button
            type="button"
            className="w-full text-left text-xs text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 sm:ml-auto sm:w-auto sm:text-right"
            onClick={onReset}
          >
            조건 초기화
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TemplateFilterButton({
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
