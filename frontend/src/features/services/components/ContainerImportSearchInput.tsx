import { Search } from "lucide-react";

import type { ContainerImportMode } from "./containerImportTypes";

interface ContainerImportSearchInputProps {
  mode: ContainerImportMode;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export default function ContainerImportSearchInput({
  mode,
  searchQuery,
  onSearchQueryChange,
}: ContainerImportSearchInputProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        className="input pl-9"
        placeholder={
          mode === "basic"
            ? "컨테이너 이름, 이미지, 포트, 네트워크로 검색"
            : "도메인, 컨테이너 이름, router, 네트워크로 검색"
        }
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
      />
    </div>
  );
}
