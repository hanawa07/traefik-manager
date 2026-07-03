import { Search } from "lucide-react";

interface ServicesSearchFieldProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function ServicesSearchField({ search, onSearchChange }: ServicesSearchFieldProps) {
  return (
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
  );
}
