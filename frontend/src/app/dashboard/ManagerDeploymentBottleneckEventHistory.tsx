"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import type { ManagerDeploymentBottleneckEvent } from "@/features/deployment/api/deploymentApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  MANAGER_DEPLOYMENT_FAILURE_STAGE_LABELS,
  formatManagerDeploymentDurationMs,
} from "./managerDeploymentHistoryDisplay";
import {
  downloadManagerDeploymentBottleneckEvents,
  type ManagerDeploymentBottleneckEventExportFormat,
  type ManagerDeploymentBottleneckEventFilter,
  type ManagerDeploymentBottleneckEventPeriod,
} from "./managerDeploymentBottleneckEventExport";
import { replaceManagerDeploymentHistoryQueryParams } from "./managerDeploymentHistoryQuery";

const EVENT_FILTER_QUERY = "deployment_bottleneck_event_type";
const PERIOD_QUERY = "deployment_bottleneck_event_period";

const EVENT_FILTERS: readonly {
  label: string;
  value: ManagerDeploymentBottleneckEventFilter;
}[] = [
  { label: "전체", value: "all" },
  { label: "발생", value: "alerted" },
  { label: "해제", value: "cleared" },
];

const PERIODS: readonly { label: string; value: ManagerDeploymentBottleneckEventPeriod }[] = [
  { label: "전체 기간", value: "all" },
  { label: "최근 24시간", value: "1" },
  { label: "최근 7일", value: "7" },
  { label: "최근 30일", value: "30" },
];

export function ManagerDeploymentBottleneckEventHistory({
  events,
  timezone,
}: {
  events: ManagerDeploymentBottleneckEvent[];
  timezone?: string;
}) {
  return (
    <Suspense fallback={null}>
      <ManagerDeploymentBottleneckEventHistoryContent events={events} timezone={timezone} />
    </Suspense>
  );
}

function ManagerDeploymentBottleneckEventHistoryContent({
  events,
  timezone,
}: {
  events: ManagerDeploymentBottleneckEvent[];
  timezone?: string;
}) {
  const searchParams = useSearchParams();
  const [eventFilter, setEventFilter] = useState<ManagerDeploymentBottleneckEventFilter>(() =>
    parseEventFilter(searchParams.get(EVENT_FILTER_QUERY)),
  );
  const [period, setPeriod] = useState<ManagerDeploymentBottleneckEventPeriod>(() =>
    parseEventPeriod(searchParams.get(PERIOD_QUERY)),
  );
  const [periodReferenceTime, setPeriodReferenceTime] = useState(() => Date.now());
  const [exportNotice, setExportNotice] = useState("");
  if (events.length === 0) return null;

  const cutoff = period === "all"
    ? null
    : periodReferenceTime - Number(period) * 24 * 60 * 60 * 1_000;
  const periodEvents = cutoff === null
    ? events
    : events.filter((event) => Date.parse(event.occurred_at) >= cutoff);
  const filteredEvents = eventFilter === "all"
    ? periodEvents
    : periodEvents.filter((event) => event.event === eventFilter);

  const handleExport = (format: ManagerDeploymentBottleneckEventExportFormat) => {
    try {
      const filename = downloadManagerDeploymentBottleneckEvents(
        filteredEvents,
        { event: eventFilter, period },
        format,
        timezone,
      );
      setExportNotice(`${format.toUpperCase()} 내보내기 완료 · ${filename}`);
    } catch {
      setExportNotice(`${format.toUpperCase()} 내보내기 실패`);
    }
  };

  return (
    <details className="mt-3 border-t border-current/15 pt-2" data-manager-deployment-bottleneck-events>
      <summary className="w-fit cursor-pointer font-semibold">
        발생·해제 이력 {events.length}건
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <label>
          <span className="sr-only">병목 이력 기간</span>
          <select
            aria-label="병목 이력 기간"
            className="rounded-full border border-current/20 bg-white/70 px-2 py-1 text-[11px] font-semibold dark:bg-slate-950/40"
            data-bottleneck-event-period
            onChange={(event) => {
              const nextPeriod = event.target.value as ManagerDeploymentBottleneckEventPeriod;
              setPeriodReferenceTime(Date.now());
              setPeriod(nextPeriod);
              setExportNotice("");
              replaceManagerDeploymentHistoryQueryParams([
                [PERIOD_QUERY, nextPeriod, "all"],
              ]);
            }}
            value={period}
          >
            {PERIODS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="병목 이력 종류 필터">
          {EVENT_FILTERS.map((option) => {
            const active = eventFilter === option.value;
            const count = option.value === "all"
              ? periodEvents.length
              : periodEvents.filter((event) => event.event === option.value).length;
            return (
              <button
                aria-pressed={active}
                className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${active ? "border-current bg-white/80 dark:bg-slate-950/50" : "border-current/20 opacity-75"}`}
                data-bottleneck-event-filter={option.value}
                key={option.value}
                onClick={() => {
                  setEventFilter(option.value);
                  setExportNotice("");
                  replaceManagerDeploymentHistoryQueryParams([
                    [EVENT_FILTER_QUERY, option.value, "all"],
                  ]);
                }}
                type="button"
              >
                {option.label} {count}
              </button>
            );
          })}
        </div>
        {(["json", "csv"] as const).map((format) => (
          <button
            aria-label={`현재 병목 이력 ${filteredEvents.length}건 ${format.toUpperCase()} 내보내기`}
            className="whitespace-nowrap rounded-full border border-current/20 bg-white/70 px-2 py-1 text-[11px] font-semibold dark:bg-slate-950/40"
            data-bottleneck-event-export={format}
            key={format}
            onClick={() => handleExport(format)}
            type="button"
          >
            {format.toUpperCase()} · {filteredEvents.length}건
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-1 min-h-4 opacity-75" data-bottleneck-event-export-notice>
        {exportNotice || `현재 결과 ${filteredEvents.length}건`}
      </p>
      {filteredEvents.length === 0 ? (
        <p className="mt-2 rounded-lg bg-white/60 px-2.5 py-2 dark:bg-slate-950/30">
          선택한 조건의 발생·해제 이력이 없습니다.
        </p>
      ) : (
        <ol className="mt-2 grid gap-1.5">
          {filteredEvents.map((event, index) => (
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
      )}
    </details>
  );
}

function parseEventFilter(value: string | null): ManagerDeploymentBottleneckEventFilter {
  return value === "alerted" || value === "cleared" ? value : "all";
}

function parseEventPeriod(value: string | null): ManagerDeploymentBottleneckEventPeriod {
  return value === "1" || value === "7" || value === "30" ? value : "all";
}
