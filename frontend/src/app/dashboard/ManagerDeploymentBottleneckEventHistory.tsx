import type { ManagerDeploymentBottleneckEvent } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  formatManagerDeploymentDurationMs,
} from "./managerDeploymentHistoryDisplay";

export function ManagerDeploymentBottleneckEventHistory({
  events,
  timezone,
}: {
  events: ManagerDeploymentBottleneckEvent[];
  timezone?: string;
}) {
  if (events.length === 0) return null;

  return (
    <details className="mt-3 border-t border-current/15 pt-2" data-manager-deployment-bottleneck-events>
      <summary className="w-fit cursor-pointer font-semibold">
        발생·해제 이력 {events.length}건
      </summary>
      <ol className="mt-2 grid gap-1.5">
        {events.map((event, index) => (
          <li
            className="rounded-lg bg-white/60 px-2.5 py-2 dark:bg-slate-950/30"
            data-manager-deployment-bottleneck-event={event.event}
            key={`${event.occurred_at}-${event.event}-${index}`}
          >
            <p className="font-semibold">
              {event.event === "alerted" ? "알림 발생" : "상태 해제"}
              {` · ${formatDateTime(event.occurred_at, timezone)}`}
            </p>
            <p className="mt-0.5 opacity-80">
              기준 {formatManagerDeploymentDurationMs(event.threshold_ms)} 초과 · 연속 {event.current_consecutive_count}/{event.required_consecutive_count}회
              {event.latest_version ? ` · ${event.latest_version}` : ""}
              {event.slowest_stage
                ? ` · ${MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS[event.slowest_stage]} ${formatManagerDeploymentDurationMs(event.slowest_ms)}`
                : ""}
              {event.run_url ? (
                <>{" · "}<a className="font-semibold underline underline-offset-2" href={event.run_url} rel="noreferrer" target="_blank">워크플로</a></>
              ) : null}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}
