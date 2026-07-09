import { Search } from "lucide-react";

interface GeneratedMiddlewaresHeaderProps {
  generatedSearch: string;
  onGeneratedSearchChange: (value: string) => void;
}

export function GeneratedMiddlewaresHeader({
  generatedSearch,
  onGeneratedSearchChange,
}: GeneratedMiddlewaresHeaderProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">서비스별 자동 생성 미들웨어</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            서비스 설정에서 자동 만들어지는 실제 Traefik 미들웨어만 모아봅니다. 공유 템플릿은 여기서 제외됩니다.
          </p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            value={generatedSearch}
            onChange={(event) => onGeneratedSearchChange(event.target.value)}
            className={
              "w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 " +
              "outline-none transition-colors focus:border-blue-400 " +
              "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            }
            placeholder="서비스 이름 또는 도메인 검색"
          />
        </div>
      </div>
    </div>
  );
}
