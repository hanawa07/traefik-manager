import type { ContainerImportMode } from "./containerImportTypes";

interface ContainerImportModeTabsProps {
  basicCount: number;
  mode: ContainerImportMode;
  onModeChange: (mode: ContainerImportMode) => void;
  traefikCount: number;
}

export default function ContainerImportModeTabs({
  basicCount,
  mode,
  onModeChange,
  traefikCount,
}: ContainerImportModeTabsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
      <button
        type="button"
        className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
          mode === "basic" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
        }`}
        onClick={() => onModeChange("basic")}
      >
        <span className="flex items-center justify-between gap-2">
          일반 컨테이너
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{basicCount}</span>
        </span>
        <span className="mt-0.5 block text-[11px] font-normal opacity-70">이름/포트만 빠르게 채움</span>
      </button>
      <button
        type="button"
        className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
          mode === "traefik" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
        }`}
        onClick={() => onModeChange("traefik")}
      >
        <span className="flex items-center justify-between gap-2">
          기존 Traefik 설정
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{traefikCount}</span>
        </span>
        <span className="mt-0.5 block text-[11px] font-normal opacity-70">도메인/라우터 라벨까지 가져옴</span>
      </button>
    </div>
  );
}
