import type { ManagerDeploymentHistoryArchiveSummary as ArchiveSummary } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

export function ManagerDeploymentHistoryArchiveSummary({
  summary,
  timezone,
}: {
  summary?: ArchiveSummary;
  timezone?: string;
}) {
  const detailedCount = summary?.detailed_count ?? 0;
  const dailyCount = summary?.daily_count ?? 0;
  const totalCount = detailedCount + dailyCount;

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400"
      data-daily-archive-count={dailyCount}
      data-deployment-archive-newest-at={summary?.newest_at ?? undefined}
      data-deployment-archive-oldest-at={summary?.oldest_at ?? undefined}
      data-deployment-history-retention
      data-detailed-archive-count={detailedCount}
    >
      <strong className="text-slate-600 dark:text-slate-300">보관 구성</strong>
      <span>상세 {detailedCount}건</span>
      <span>일별 {dailyCount}건</span>
      <span data-deployment-archive-range>
        {totalCount > 0
          ? `${formatDateTime(summary?.oldest_at, timezone)} ~ ${formatDateTime(summary?.newest_at, timezone)}`
          : "보관 이력 없음"}
      </span>
      <span className="basis-full">
        상세 회전본 이후 오래된 기록은 UTC 날짜별 마지막 배포 1건으로 축약해 보관합니다.
      </span>
    </div>
  );
}
