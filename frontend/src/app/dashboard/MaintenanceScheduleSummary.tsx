"use client";

import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Construction,
  History,
  Loader2,
  Play,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Service } from "@/features/services/api/serviceApi";
import { useUpdateServiceMaintenance } from "@/features/services/hooks/useServices";
import {
  extendMaintenanceUntil,
  formatMaintenanceRemaining,
  getMaintenanceSchedule,
  toKoreanDateTimeLocal,
  toMaintenanceUntilIso,
  type MaintenanceScheduleEntry,
  type MaintenanceScheduleService,
} from "@/features/services/lib/maintenanceSchedule";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { MaintenanceScheduleHistoryPanel } from "./MaintenanceScheduleHistoryPanel";

interface MaintenanceScheduleSummaryProps {
  canManage: boolean;
  isLoading: boolean;
  services: Service[];
  timezone?: string;
}

interface MaintenanceFeedback {
  message: string;
  tone: "error" | "success";
}

export function MaintenanceScheduleSummary({
  canManage,
  isLoading,
  services,
  timezone,
}: MaintenanceScheduleSummaryProps) {
  const [now, setNow] = useState(Date.now);
  const [feedback, setFeedback] = useState<MaintenanceFeedback | null>(null);
  const [showAll, setShowAll] = useState(false);
  const maintenanceUpdate = useUpdateServiceMaintenance();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleExtend = async (service: MaintenanceScheduleService, hours: number) => {
    setFeedback(null);
    try {
      await maintenanceUpdate.mutateAsync({
        serviceId: service.id,
        maintenanceUntil: extendMaintenanceUntil(service.maintenance_until, hours),
        routingMode: "maintenance",
      });
      setFeedback({ message: `${service.name} 점검 종료를 ${hours}시간 연장했습니다.`, tone: "success" });
    } catch (error) {
      setFeedback({ message: getMaintenanceUpdateError(error), tone: "error" });
    }
  };

  const handleActivate = async (service: MaintenanceScheduleService) => {
    if (!window.confirm(`${service.name} 서비스를 지금 정상 운영으로 전환할까요?`)) return;
    setFeedback(null);
    try {
      await maintenanceUpdate.mutateAsync({
        serviceId: service.id,
        maintenanceUntil: null,
        routingMode: "active",
      });
      setFeedback({ message: `${service.name} 서비스를 정상 운영으로 전환했습니다.`, tone: "success" });
    } catch (error) {
      setFeedback({ message: getMaintenanceUpdateError(error), tone: "error" });
    }
  };

  const handleSetUntil = async (
    service: MaintenanceScheduleService,
    maintenanceUntil: string,
  ) => {
    setFeedback(null);
    try {
      await maintenanceUpdate.mutateAsync({
        serviceId: service.id,
        maintenanceUntil,
        routingMode: "maintenance",
      });
      setFeedback({ message: `${service.name} 점검 종료 시각을 변경했습니다.`, tone: "success" });
    } catch (error) {
      setFeedback({ message: getMaintenanceUpdateError(error), tone: "error" });
    }
  };

  if (isLoading) {
    return <div className="card mb-6 h-32 animate-pulse dark:bg-slate-900" />;
  }

  const entries = getMaintenanceSchedule(services, now);
  const soonCount = entries.filter((entry) => entry.timing === "soon").length;
  const overdueCount = entries.filter((entry) => entry.timing === "overdue").length;
  const unscheduledCount = entries.filter((entry) => entry.timing === "unscheduled").length;
  const visibleEntries = showAll ? entries : entries.slice(0, 3);

  return (
    <section
      className="card mb-6 overflow-hidden"
      data-maintenance-service-count={entries.length}
      data-testid="maintenance-schedule-summary"
    >
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

      {feedback ? (
        <p
          className={`border-b px-5 py-2 text-xs font-semibold ${feedback.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-200"}`}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}

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
          <ul
            className="divide-y divide-slate-100 px-5 py-2 dark:divide-slate-800"
            id="maintenance-schedule-list"
          >
            {visibleEntries.map((entry) => (
              <MaintenanceScheduleRow
                canManage={canManage}
                entry={entry}
                isCurrentUpdate={
                  maintenanceUpdate.isPending &&
                  maintenanceUpdate.variables?.serviceId === entry.service.id
                }
                isUpdatePending={maintenanceUpdate.isPending}
                key={entry.service.id}
                now={now}
                timezone={timezone}
                onActivate={handleActivate}
                onExtend={handleExtend}
                onSetUntil={handleSetUntil}
              />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              {entries.length > 3 && !showAll
                ? `${entries.length - 3}개 서비스가 더 있습니다.`
                : "종료 시각순으로 표시합니다."}
            </span>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {entries.length > 3 ? (
                <button
                  aria-controls="maintenance-schedule-list"
                  aria-expanded={showAll}
                  className="font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                  data-maintenance-schedule-toggle
                  type="button"
                  onClick={() => setShowAll((current) => !current)}
                >
                  {showAll ? "간단히 보기" : `전체 ${entries.length}개 보기`}
                </button>
              ) : null}
              <Link
                className="font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                href="/dashboard/services?health=maintenance"
              >
                점검 서비스 보기
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function MaintenanceScheduleRow({
  canManage,
  entry,
  isCurrentUpdate,
  isUpdatePending,
  now,
  onActivate,
  onExtend,
  onSetUntil,
  timezone,
}: {
  canManage: boolean;
  entry: MaintenanceScheduleEntry;
  isCurrentUpdate: boolean;
  isUpdatePending: boolean;
  now: number;
  onActivate: (service: MaintenanceScheduleService) => Promise<void>;
  onExtend: (service: MaintenanceScheduleService, hours: number) => Promise<void>;
  onSetUntil: (service: MaintenanceScheduleService, maintenanceUntil: string) => Promise<void>;
  timezone?: string;
}) {
  const remaining = formatMaintenanceRemaining(entry.service.maintenance_until, now);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  return (
    <li
      className="flex flex-wrap items-center gap-3 py-3"
      data-maintenance-service-id={entry.service.id}
      data-maintenance-timing={entry.timing}
      data-maintenance-until={entry.service.maintenance_until ?? undefined}
    >
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
      <button
        aria-expanded={isHistoryOpen}
        aria-label={`${entry.service.name} 점검 종료 시각 변경 이력`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-amber-800 dark:text-slate-300 dark:hover:text-amber-200"
        onClick={() => setIsHistoryOpen((current) => !current)}
        type="button"
      >
        <History className="h-3.5 w-3.5" />
        {isHistoryOpen ? "이력 닫기" : "변경 이력"}
      </button>
      {canManage ? (
        <div className="flex basis-full flex-wrap items-center justify-end gap-2 pl-7">
          {isCurrentUpdate ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              반영 중
            </span>
          ) : (
            <>
              <MaintenanceUntilEditor
                disabled={isUpdatePending}
                key={entry.service.maintenance_until ?? "unscheduled"}
                service={entry.service}
                onSetUntil={onSetUntil}
              />
              <button
                aria-label={`${entry.service.name} 점검 1시간 연장`}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/30 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950"
                disabled={isUpdatePending}
                type="button"
                onClick={() => void onExtend(entry.service, 1)}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                1시간 연장
              </button>
              <button
                aria-label={`${entry.service.name} 점검 1일 연장`}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/30 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950"
                disabled={isUpdatePending}
                type="button"
                onClick={() => void onExtend(entry.service, 24)}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                1일 연장
              </button>
              <button
                aria-label={`${entry.service.name} 지금 정상 운영`}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                disabled={isUpdatePending}
                type="button"
                onClick={() => void onActivate(entry.service)}
              >
                <Play className="h-3.5 w-3.5" />
                지금 정상 운영
              </button>
            </>
          )}
        </div>
      ) : null}
      {isHistoryOpen ? (
        <div className="basis-full pl-7">
          <MaintenanceScheduleHistoryPanel serviceId={entry.service.id} timezone={timezone} />
        </div>
      ) : null}
    </li>
  );
}

function MaintenanceUntilEditor({
  disabled,
  service,
  onSetUntil,
}: {
  disabled: boolean;
  service: MaintenanceScheduleService;
  onSetUntil: (service: MaintenanceScheduleService, maintenanceUntil: string) => Promise<void>;
}) {
  const [value, setValue] = useState(() => toKoreanDateTimeLocal(service.maintenance_until));
  const maintenanceUntil = toMaintenanceUntilIso(value);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        종료 시각
        <input
          aria-label={`${service.name} 점검 종료 시각`}
          className="w-[12.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          type="datetime-local"
          value={value}
        />
      </label>
      <button
        aria-label={`${service.name} 점검 종료 시각 적용`}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        disabled={disabled || !maintenanceUntil}
        onClick={() => maintenanceUntil && void onSetUntil(service, maintenanceUntil)}
        type="button"
      >
        적용
      </button>
    </div>
  );
}

function getMaintenanceUpdateError(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || "점검 일정을 변경하지 못했습니다.";
}
