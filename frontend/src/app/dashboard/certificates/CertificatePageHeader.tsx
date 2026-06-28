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
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">인증서</h1>
        <p className="text-gray-500 text-sm mt-1">Traefik API 기반 TLS 인증서 상태</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRunCheck}
          className="btn-primary flex items-center gap-2"
          disabled={isRunningCheck}
        >
          <Shield className="w-4 h-4" />
          {isRunningCheck ? "검사 중..." : "경고 검사"}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          className="btn-secondary flex items-center gap-2"
          disabled={isRefreshing}
        >
          <RefreshCcw className="w-4 h-4" />
          {isRefreshing ? "갱신 중..." : "새로고침"}
        </button>
      </div>
    </div>
  );
}
