import { ExternalLink } from "lucide-react";

import type { DeploymentInfo } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  getExternalWatchdogRunLabel,
  isExternalWatchdogRunFailure,
} from "./managerWatchdogStatus";

export function ManagerWatchdogAlertHistory({
  deployment,
  timezone,
}: {
  deployment?: DeploymentInfo;
  timezone?: string;
}) {
  const runs = deployment?.external_watchdog_alert_runs || [];

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
          최근 watchdog 알림 실행
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          외부 가용성 watchdog이 요청한 최근 GitHub Actions 실행 5건입니다.
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">아직 실행 기록이 없습니다.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 dark:divide-slate-800">
          {runs.map((run) => {
            const failed = isExternalWatchdogRunFailure(run.conclusion);
            return (
              <li className="flex flex-wrap items-start gap-2 py-3 text-xs" key={run.run_url}>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                    run.event === "failure"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                  }`}
                >
                  {run.event === "failure" ? "장애" : "복구"}
                </span>
                <div className="min-w-0 flex-[1_1_14rem]">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-gray-600 dark:text-slate-300">
                      요청: {formatDateTime(run.requested_at, timezone)}
                    </span>
                    <span
                      className={failed ? "font-semibold text-rose-700 dark:text-rose-200" : "text-gray-500 dark:text-slate-400"}
                    >
                      결과: {getExternalWatchdogRunLabel(run.status, run.conclusion, run.error)}
                    </span>
                    {run.checked_at ? (
                      <span className="text-gray-500 dark:text-slate-400">
                        결과 확인: {formatDateTime(run.checked_at, timezone)}
                      </span>
                    ) : null}
                  </div>
                  {run.error ? (
                    <p className="mt-1 break-words text-rose-700 dark:text-rose-200">
                      조회 오류: {run.error}
                    </p>
                  ) : null}
                </div>
                <a
                  className="ml-auto inline-flex shrink-0 items-center gap-1 font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                  href={run.run_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  실행 보기
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
