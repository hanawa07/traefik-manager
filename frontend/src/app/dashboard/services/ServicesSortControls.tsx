import { ArrowUpDown } from "lucide-react";

import type { HealthFilter, SortDir, SortKey } from "./useServicesPageModel";
import { HEALTH_FILTER_OPTIONS, SORT_OPTIONS } from "./servicesToolbarOptions";

interface ServicesSortControlsProps {
  healthFilter: HealthFilter;
  sortKey: SortKey;
  sortDir: SortDir;
  onHealthFilterChange: (value: HealthFilter) => void;
  onSortKeyChange: (value: SortKey) => void;
  onSortDirChange: (updater: (value: SortDir) => SortDir) => void;
}

export function ServicesSortControls({
  healthFilter,
  sortKey,
  sortDir,
  onHealthFilterChange,
  onSortKeyChange,
  onSortDirChange,
}: ServicesSortControlsProps) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <ArrowUpDown className="h-4 w-4 text-gray-400" />
      <select
        value={healthFilter}
        onChange={(event) => onHealthFilterChange(event.target.value as HealthFilter)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {HEALTH_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        value={sortKey}
        onChange={(event) => {
          onSortKeyChange(event.target.value as SortKey);
          onSortDirChange(() => "asc");
        }}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onSortDirChange((value) => (value === "asc" ? "desc" : "asc"))}
        className="min-w-[70px] select-none rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
        title={sortDir === "asc" ? "오름차순" : "내림차순"}
      >
        {sortDir === "asc" ? "↑ 오름" : "↓ 내림"}
      </button>
    </div>
  );
}
