import Link from "next/link";

import type { ManagerHttpRequestLogStorage } from "@/features/deployment/api/deploymentApi";
import { formatBytes } from "@/shared/lib/formatBytes";

import { getManagerApiAuditUrl } from "./managerAuditLinks";

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
  const warningKind =
    storage.source === "unavailable"
      ? "unavailable"
      : storage.source === "docker"
      ? "docker"
      : storage.source === "persistent" && usagePercent >= 80
        ? "capacity"
        : null;
  const warningMessage =
    warningKind === "unavailable"
      ? "요청 로그를 읽을 수 없습니다. 영속 볼륨과 Docker 로그 접근 상태를 확인하세요."
      : warningKind === "docker"
      ? "영속 로그를 사용할 수 없어 Docker 로그로 대체 중입니다. 재배포하면 이전 표본이 사라질 수 있습니다."
      : warningKind === "capacity"
        ? "영속 로그 용량이 80% 이상입니다. 24시간 표본이 유지되는지 관측 시작 시각을 확인하세요."
        : null;

  return (
    <div
      className={`border-b px-4 py-3 text-xs ${
        warningKind
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
          : "border-slate-200 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
      }`}
      data-log-capacity-bytes={storage.capacity_bytes}
      data-log-file-count={storage.file_count}
      data-log-max-file-count={storage.max_file_count}
      data-log-rotated-file-count={storage.rotated_file_count}
      data-log-size-bytes={storage.size_bytes}
      data-log-source={storage.source}
      data-log-warning={warningKind ?? "none"}
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
      {warningMessage ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium" data-testid="manager-http-log-storage-warning" role="status">
            {warningMessage}
          </p>
          <Link
            className="font-semibold underline decoration-amber-500/50 underline-offset-2 hover:decoration-current"
            data-testid="manager-http-log-storage-audit-link"
            href={getManagerApiAuditUrl("request-log-storage")}
          >
            관련 Manager 이력 보기
          </Link>
        </div>
      ) : null}
    </div>
  );
}
