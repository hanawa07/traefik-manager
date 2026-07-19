"use client";

import { AlertTriangle, CheckCircle2, Clock3, Construction } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Service } from "@/features/services/api/serviceApi";
import {
  formatMaintenanceRemaining,
  getMaintenanceSchedule,
  type MaintenanceScheduleEntry,
} from "@/features/services/lib/maintenanceSchedule";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface MaintenanceScheduleSummaryProps {
  isLoading: boolean;
  services: Service[];
  timezone?: string;
}

export function MaintenanceScheduleSummary({
  isLoading,
  services,
  timezone,
}: MaintenanceScheduleSummaryProps) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (isLoading) {
    return <div className="card mb-6 h-32 animate-pulse dark:bg-slate-900" />;
  }

  const entries = getMaintenanceSchedule(services, now);
  const soonCount = entries.filter((entry) => entry.timing === "soon").length;
  const overdueCount = entries.filter((entry) => entry.timing === "overdue").length;
  const unscheduledCount = entries.filter((entry) => entry.timing === "unscheduled").length;

  return (
    <section className="card mb-6 overflow-hidden" data-testid="maintenance-schedule-summary">
      <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
          <Construction className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-bold text-slate-950 dark:text-slate-100">점검 종료 일정</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            현재 점검 안내 중인 서비스와 자동 운영 전환 시각입니다.
          </p>
        </div>
        <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
          {entries.length}개 점검 중
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          현재 점검 안내 중인 서비스가 없습니다.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 px-5 pt-4 text-xs font-semibold">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
              24시간 내 종료 {soonCount}
            </span>
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">
              종료 처리 대기 {overdueCount}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              종료 미정 {unscheduledCount}
            </span>
          </div>
          <ul className="divide-y divide-slate-100 px-5 py-2 dark:divide-slate-800">
            {entries.slice(0, 3).map((entry) => (
              <MaintenanceScheduleRow entry={entry} key={entry.service.id} now={now} timezone={timezone} />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              {entries.length > 3 ? `${entries.length - 3}개 서비스가 더 있습니다.` : "종료 시각순으로 표시합니다."}
            </span>
            <Link
              className="font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
              href="/dashboard/services?health=maintenance"
            >
              점검 서비스 보기
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function MaintenanceScheduleRow({
  entry,
  now,
  timezone,
}: {
  entry: MaintenanceScheduleEntry;
  now: number;
  timezone?: string;
}) {
  const remaining = formatMaintenanceRemaining(entry.service.maintenance_until, now);
  return (
    <li className="flex flex-wrap items-center gap-3 py-3" data-maintenance-timing={entry.timing}>
      {entry.timing === "overdue" ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
      ) : (
        <Clock3 className="h-4 w-4 shrink-0 text-amber-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.service.name}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{entry.service.domain}</p>
      </div>
      <div className="text-right" suppressHydrationWarning>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {remaining ?? "종료 시각 미설정"}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {entry.endTimestamp === null
            ? "자동 종료 없음"
            : formatDateTime(entry.service.maintenance_until, timezone)}
        </p>
      </div>
    </li>
  );
}
