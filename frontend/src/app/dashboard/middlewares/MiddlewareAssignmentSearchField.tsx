import { Search } from "lucide-react";

interface MiddlewareAssignmentSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function MiddlewareAssignmentSearchField({
  value,
  onChange,
}: MiddlewareAssignmentSearchFieldProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400"
        placeholder="서비스 이름 또는 도메인 검색"
      />
    </div>
  );
}
