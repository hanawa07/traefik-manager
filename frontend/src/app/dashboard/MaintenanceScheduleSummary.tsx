"use client";

import { CheckCircle2, Construction } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Service } from "@/features/services/api/serviceApi";
import { useUpdateServiceMaintenance } from "@/features/services/hooks/useServices";
import {
  extendMaintenanceUntil,
  getMaintenanceSchedule,
  type MaintenanceScheduleService,
} from "@/features/services/lib/maintenanceSchedule";
import { MaintenanceScheduleRow } from "./MaintenanceScheduleRow";
import {
  readMaintenanceHistoryServiceId,
  replaceMaintenanceHistoryServiceId,
} from "./maintenanceHistoryServiceQuery";

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
  const [historyServiceId, setHistoryServiceId] = useState<string | null>(null);
  const maintenanceUpdate = useUpdateServiceMaintenance();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setHistoryServiceId(readMaintenanceHistoryServiceId());
  }, []);

  const handleHistoryToggle = (serviceId: string) => {
    const nextServiceId = historyServiceId === serviceId ? null : serviceId;
    setHistoryServiceId(nextServiceId);
    replaceMaintenanceHistoryServiceId(nextServiceId);
  };

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
  const isExpanded = showAll || historyServiceId !== null;
  const visibleEntries = isExpanded ? entries : entries.slice(0, 3);
  const handleScheduleToggle = () => {
    if (isExpanded) {
      setShowAll(false);
      setHistoryServiceId(null);
      replaceMaintenanceHistoryServiceId(null);
      return;
    }
    setShowAll(true);
  };

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
                isHistoryOpen={historyServiceId === entry.service.id}
                isUpdatePending={maintenanceUpdate.isPending}
                key={entry.service.id}
                now={now}
                timezone={timezone}
                onActivate={handleActivate}
                onExtend={handleExtend}
                onHistoryToggle={handleHistoryToggle}
                onSetUntil={handleSetUntil}
              />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              {entries.length > 3 && !isExpanded
                ? `${entries.length - 3}개 서비스가 더 있습니다.`
                : "종료 시각순으로 표시합니다."}
            </span>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {entries.length > 3 ? (
                <button
                  aria-controls="maintenance-schedule-list"
                  aria-expanded={isExpanded}
                  className="font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                  data-maintenance-schedule-toggle
                  type="button"
                  onClick={handleScheduleToggle}
                >
                  {isExpanded ? "간단히 보기" : `전체 ${entries.length}개 보기`}
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

function getMaintenanceUpdateError(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || "점검 일정을 변경하지 못했습니다.";
}
