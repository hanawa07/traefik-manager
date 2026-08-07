import { RefreshCw, ShieldAlert } from "lucide-react";

import { getCertificateErrorDetail } from "./certificatePageHelpers";

interface CertificateListErrorStateProps {
  error: unknown;
  isRetrying: boolean;
  onRetry: () => void;
}

export default function CertificateListErrorState({
  error,
  isRetrying,
  onRetry,
}: CertificateListErrorStateProps) {
  return (
    <div
      className="card mb-6 border-red-200 bg-red-50 px-6 py-14 text-center dark:border-red-500/50 dark:bg-red-950/30"
      data-testid="certificates-list-error"
      role="alert"
    >
      <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-red-300 dark:text-red-400" />
      <p className="text-sm font-medium text-red-700 dark:text-red-300">
        인증서 정보를 가져오지 못했습니다
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
        {getCertificateErrorDetail(error, "잠시 후 다시 시도해 주세요")}
      </p>
      <button
        className="btn-secondary mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-xs"
        data-testid="certificates-list-retry"
        disabled={isRetrying}
        onClick={onRetry}
        type="button"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
        {isRetrying ? "다시 확인 중" : "다시 시도"}
      </button>
    </div>
  );
}
