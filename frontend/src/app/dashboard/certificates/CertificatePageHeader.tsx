import { RefreshCcw, Shield } from "lucide-react";

interface CertificatePageHeaderProps {
  isRefreshing: boolean;
  isRunningCheck: boolean;
  onRefresh: () => void;
  onRunCheck: () => void;
}

export default function CertificatePageHeader({
  isRefreshing,
  isRunningCheck,
  onRefresh,
  onRunCheck,
}: CertificatePageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col items-stretch gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">인증서</h1>
        <p className="text-gray-500 text-sm mt-1 dark:text-slate-400">Traefik API 기반 TLS 인증서 상태</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <button
          type="button"
          onClick={onRunCheck}
          className="btn-primary flex items-center justify-center gap-2"
          disabled={isRunningCheck}
        >
          <Shield className="w-4 h-4" />
          {isRunningCheck ? "검사 중..." : "경고 검사"}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="btn-secondary flex items-center justify-center gap-2"
          disabled={isRefreshing}
        >
          <RefreshCcw className="w-4 h-4" />
          {isRefreshing ? "갱신 중..." : "새로고침"}
        </button>
      </div>
    </div>
  );
}
