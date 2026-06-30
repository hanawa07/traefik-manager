import { Loader2, RefreshCcw } from "lucide-react";

const PREFLIGHT_BUTTON_CLASS = [
  "inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2",
  "text-xs font-medium text-gray-700 transition-colors",
  "hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
].join(" ");

interface CertificateChecklistHeaderProps {
  isRunning: boolean;
  onRunPreflight: () => void;
}

export default function CertificateChecklistHeader({
  isRunning,
  onRunPreflight,
}: CertificateChecklistHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">발급 체크리스트</h3>
        <p className="mt-1 text-xs text-gray-500">
          목록은 압축해서 보여주고, 상세 진단은 이 패널에서 확인합니다.
        </p>
      </div>
      <button
        type="button"
        onClick={onRunPreflight}
        className={PREFLIGHT_BUTTON_CLASS}
        disabled={isRunning}
      >
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCcw className="h-3.5 w-3.5" />
        )}
        {isRunning ? "진단 중..." : "사전 진단"}
      </button>
    </div>
  );
}
