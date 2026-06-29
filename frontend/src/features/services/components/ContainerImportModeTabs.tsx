import type { ContainerImportMode } from "./containerImportTypes";

interface ContainerImportModeTabsProps {
  mode: ContainerImportMode;
  onModeChange: (mode: ContainerImportMode) => void;
}

export default function ContainerImportModeTabs({ mode, onModeChange }: ContainerImportModeTabsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
      <button
        type="button"
        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          mode === "basic" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
        }`}
        onClick={() => onModeChange("basic")}
      >
        일반 컨테이너
      </button>
      <button
        type="button"
        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          mode === "traefik" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
        }`}
        onClick={() => onModeChange("traefik")}
      >
        기존 Traefik 설정
      </button>
    </div>
  );
}
