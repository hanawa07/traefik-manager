import type { HealthFilter, SortDir, SortKey } from "./useServicesPageModel";
import { ServicesSearchField } from "./ServicesSearchField";
import { ServicesSortControls } from "./ServicesSortControls";

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
      <ServicesSearchField search={search} onSearchChange={onSearchChange} />
      <ServicesSortControls
        healthFilter={healthFilter}
        sortKey={sortKey}
        sortDir={sortDir}
        onHealthFilterChange={onHealthFilterChange}
        onSortKeyChange={onSortKeyChange}
        onSortDirChange={onSortDirChange}
      />
    </div>
  );
}
