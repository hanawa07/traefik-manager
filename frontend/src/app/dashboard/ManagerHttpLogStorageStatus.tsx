import type { ManagerHttpRequestLogStorage } from "@/features/deployment/api/deploymentApi";
import { formatBytes } from "@/shared/lib/formatBytes";

interface ManagerHttpLogStorageStatusProps {
  storage: ManagerHttpRequestLogStorage;
}

export function ManagerHttpLogStorageStatus({ storage }: ManagerHttpLogStorageStatusProps) {
  const sourceLabel = {
    persistent: "영속 볼륨",
    docker: "Docker 로그 폴백",
    unavailable: "사용 불가",
  }[storage.source];
  const usagePercent =
    storage.capacity_bytes > 0
      ? Math.min(100, (storage.size_bytes / storage.capacity_bytes) * 100)
      : 0;

  return (
    <div
      className="border-b border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
      data-log-capacity-bytes={storage.capacity_bytes}
      data-log-file-count={storage.file_count}
      data-log-max-file-count={storage.max_file_count}
      data-log-rotated-file-count={storage.rotated_file_count}
      data-log-size-bytes={storage.size_bytes}
      data-log-source={storage.source}
      data-testid="manager-http-log-storage"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>요청 로그 보관: {sourceLabel}</strong>
        <span>용량 사용률 {usagePercent.toFixed(1)}%</span>
      </div>
      <p className="mt-1">
        사용량 {formatBytes(storage.size_bytes)} / {formatBytes(storage.capacity_bytes)} · 파일 {storage.file_count}/
        {storage.max_file_count}개 · 회전 파일 {storage.rotated_file_count}개
      </p>
    </div>
  );
}
