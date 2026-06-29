import { ArrowUpDown, Search } from "lucide-react";

import type { HealthFilter, SortDir, SortKey } from "./useServicesPageModel";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "이름" },
  { value: "domain", label: "도메인" },
  { value: "auth", label: "인증 여부" },
  { value: "router", label: "라우터 상태" },
  { value: "health", label: "업스트림 상태" },
  { value: "created_at", label: "생성일" },
];

const HEALTH_FILTER_OPTIONS: { value: HealthFilter; label: string }[] = [
  { value: "all", label: "전체 상태" },
  { value: "down", label: "DOWN만" },
  { value: "up", label: "UP만" },
  { value: "unknown", label: "체크 안 함" },
  { value: "dns", label: "DNS 실패" },
  { value: "connection_refused", label: "연결 거부" },
  { value: "timeout", label: "타임아웃" },
  { value: "unexpected_status", label: "상태 코드 불일치" },
  { value: "other_error", label: "기타 오류" },
];

interface ServicesToolbarProps {
  search: string;
  healthFilter: HealthFilter;
  sortKey: SortKey;
  sortDir: SortDir;
  onSearchChange: (value: string) => void;
  onHealthFilterChange: (value: HealthFilter) => void;
  onSortKeyChange: (value: SortKey) => void;
  onSortDirChange: (updater: (value: SortDir) => SortDir) => void;
}

export default function ServicesToolbar({
  search,
  healthFilter,
  sortKey,
  sortDir,
  onSearchChange,
  onHealthFilterChange,
  onSortKeyChange,
  onSortDirChange,
}: ServicesToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="이름 또는 도메인 검색..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-8 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
          >
            x
          </button>
        ) : null}
      </div>
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
    </div>
  );
}
