import { GitCompareArrows } from "lucide-react";
import Link from "next/link";

import type { ManagerHttpDeploymentCorrelation as Correlation } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface ManagerHttpDeploymentCorrelationProps {
  correlations: Correlation[];
  timezone?: string;
}

export function ManagerHttpDeploymentCorrelation({
  correlations,
  timezone,
}: ManagerHttpDeploymentCorrelationProps) {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70"
      data-correlation-count={correlations.length}
      data-testid="manager-http-deployment-correlation"
    >
      <div className="flex items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-blue-600 dark:text-blue-300" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          배포 시각 상관관계
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        배포 시작 1분 전부터 완료 2분 후까지 발생한 API 오류를 함께 집계합니다.
      </p>

      {correlations.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          관측 구간에 기록된 배포가 없습니다.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
          {correlations.map((item) => (
            <li
              className="py-2 first:pt-0 last:pb-0"
              data-deployment-correlation="true"
              data-not-found-count={item.not_found_count}
              data-sample-complete={item.sample_complete ? "true" : "false"}
              data-server-error-count={item.server_error_count}
              key={`${item.revision}-${item.completed_at}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {item.version} · {getDeploymentStatusLabel(item.status)}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  완료 {formatDateTime(item.completed_at, timezone)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                관측 404 {item.not_found_count}건 · 5xx {item.server_error_count}건 · {item.sample_complete ? "표본 충분" : "표본 부족"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {formatDateTime(item.window_started_at, timezone)} ~ {formatDateTime(item.window_ended_at, timezone)}
              </p>
              {item.top_paths.length > 0 ? (
                <p className="mt-1 break-all text-[11px] text-slate-500 dark:text-slate-400">
                  상위 경로: {item.top_paths.map((path) => path.path).join(", ")}
                </p>
              ) : null}
              <Link
                className="mt-1 inline-flex text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                data-deployment-audit-link="true"
                href={`/dashboard/audit?start_date=${item.window_started_at.slice(0, 10)}&end_date=${item.window_ended_at.slice(0, 10)}`}
              >
                같은 UTC 날짜 감사 로그
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getDeploymentStatusLabel(status: Correlation["status"]): string {
  if (status === "success") return "성공";
  if (status === "failed_before_switch") return "전환 전 실패";
  if (status === "rolled_back") return "롤백 완료";
  return "롤백 실패";
}
