"use client";

import {
  AlertTriangle,
  CalendarPlus,
  Clock3,
  History,
  Loader2,
  Play,
} from "lucide-react";
import { useState } from "react";

import {
  formatMaintenanceRemaining,
  toKoreanDateTimeLocal,
  toMaintenanceUntilIso,
  type MaintenanceScheduleEntry,
  type MaintenanceScheduleService,
} from "@/features/services/lib/maintenanceSchedule";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { MaintenanceScheduleHistoryPanel } from "./MaintenanceScheduleHistoryPanel";

interface MaintenanceScheduleRowProps {
  canManage: boolean;
  entry: MaintenanceScheduleEntry;
  isCurrentUpdate: boolean;
  isHistoryOpen: boolean;
  isUpdatePending: boolean;
  now: number;
  onActivate: (service: MaintenanceScheduleService) => Promise<void>;
  onExtend: (service: MaintenanceScheduleService, hours: number) => Promise<void>;
  onHistoryToggle: (serviceId: string) => void;
  onSetUntil: (service: MaintenanceScheduleService, maintenanceUntil: string) => Promise<void>;
  timezone?: string;
}

export function MaintenanceScheduleRow({
  canManage,
  entry,
  isCurrentUpdate,
  isHistoryOpen,
  isUpdatePending,
  now,
  onActivate,
  onExtend,
  onHistoryToggle,
  onSetUntil,
  timezone,
}: MaintenanceScheduleRowProps) {
  const remaining = formatMaintenanceRemaining(entry.service.maintenance_until, now);
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
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {entry.service.name}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {entry.service.domain}
        </p>
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
        aria-controls={`maintenance-history-${entry.service.id}`}
        aria-expanded={isHistoryOpen}
        aria-label={`${entry.service.name} 점검 종료 시각 변경 이력`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-amber-800 dark:text-slate-300 dark:hover:text-amber-200"
        onClick={() => onHistoryToggle(entry.service.id)}
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
        <div className="basis-full pl-7" id={`maintenance-history-${entry.service.id}`}>
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
