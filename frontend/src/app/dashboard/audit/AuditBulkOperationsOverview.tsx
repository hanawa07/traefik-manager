"use client";

import {
  ChevronLeft,
  ChevronRight,
  Layers3,
} from "lucide-react";
import { useEffect } from "react";

import { useAuditBulkOperations } from "@/features/audit/hooks/useAudit";
import { useAuthStore } from "@/features/auth/store/useAuthStore";

import {
  auditBulkNotificationStatusOptions,
  auditBulkPeriodOptions,
  type AuditBulkNotificationStatus,
  type AuditBulkPeriod,
} from "./auditPageHelpers";
import { AuditBulkOperationCard } from "./AuditBulkOperationCard";

const PAGE_SIZE = 5;
interface AuditBulkOperationsOverviewProps {
  isRetryPending: boolean;
  notificationStatus: AuditBulkNotificationStatus;
  page: number;
  period: AuditBulkPeriod;
  retryTargetId: string | null;
  timezone?: string;
  onNotificationStatusChange: (status: AuditBulkNotificationStatus) => void;
  onPageChange: (page: number) => void;
  onPeriodChange: (period: AuditBulkPeriod) => void;
  onRetryDelivery: (auditLogId: string) => void;
}

export function AuditBulkOperationsOverview({
  isRetryPending,
  notificationStatus,
  page,
  period,
  retryTargetId,
  timezone,
  onNotificationStatusChange,
  onPageChange,
  onPeriodChange,
  onRetryDelivery,
}: AuditBulkOperationsOverviewProps) {
  const canManage = useAuthStore((state) => state.role === "admin");
  const query = useAuditBulkOperations({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    period_days: period === "all" ? undefined : Number(period) as 7 | 30 | 90,
    notification_status: notificationStatus === "all" ? undefined : notificationStatus,
  });
  const summaries = query.data?.items ?? [];
  const totalCount = query.data?.total ?? summaries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasActiveFilter = period !== "all" || notificationStatus !== "all";
  useEffect(() => {
    if (query.data && page > totalPages) onPageChange(totalPages);
  }, [onPageChange, page, query.data, totalPages]);
  if (query.isLoading) {
    return <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">최근 일괄 작업 확인 중...</p>;
  }
  if (query.isError) {
    return (
      <p className="mb-5 text-sm text-rose-700 dark:text-rose-300">
        최근 일괄 작업 요약을 불러오지 못했습니다.
      </p>
    );
  }
  if (!summaries.length && !hasActiveFilter && page === 1) return null;

  return (
    <section
      className="mb-6 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-sm dark:border-cyan-500/25 dark:from-cyan-950/30 dark:via-slate-900 dark:to-sky-950/20 dark:shadow-none"
      data-testid="audit-bulk-operations-overview"
    >
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950">
          <Layers3 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-bold text-slate-950 dark:text-slate-100">최근 서비스 일괄 작업</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            같은 작업 ID의 변경 기록과 알림 결과를 한 장으로 묶었습니다.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <span
            aria-live="polite"
            className="inline-flex items-center rounded-lg bg-cyan-100 px-2.5 py-1.5 text-xs font-bold text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200"
            data-bulk-result-count={summaries.length}
            data-bulk-total-count={totalCount}
          >
            조건 결과 {totalCount}건 · 현재 {summaries.length}건 표시
          </span>
          <select
            aria-label="일괄 작업 기간"
            className="rounded-lg border border-cyan-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-cyan-500/30 dark:bg-slate-900 dark:text-slate-200"
            value={period}
            onChange={(event) => onPeriodChange(event.target.value as AuditBulkPeriod)}
          >
            {auditBulkPeriodOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <select
            aria-label="일괄 작업 알림 상태"
            className="rounded-lg border border-cyan-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-cyan-500/30 dark:bg-slate-900 dark:text-slate-200"
            value={notificationStatus}
            onChange={(event) =>
              onNotificationStatusChange(event.target.value as AuditBulkNotificationStatus)
            }
          >
            {auditBulkNotificationStatusOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      {summaries.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {summaries.map((summary) => (
            <AuditBulkOperationCard
              key={summary.operation_id}
              canManage={canManage}
              isRetryPending={isRetryPending && retryTargetId === summary.notification_audit_id}
              onRetryDelivery={onRetryDelivery}
              summary={summary}
              timezone={timezone}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-cyan-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-cyan-500/30 dark:text-slate-400">
          선택한 조건에 맞는 일괄 작업이 없습니다.
        </p>
      )}
      {totalCount > PAGE_SIZE ? (
        <nav aria-label="일괄 작업 페이지" className="mt-4 flex items-center justify-center gap-3">
          <button
            aria-label="이전 일괄 작업 페이지"
            className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
            disabled={page === 1}
            type="button"
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            이전
          </button>
          <span
            className="text-xs font-semibold text-slate-600 dark:text-slate-300"
            data-bulk-page={page}
            data-bulk-total-pages={totalPages}
          >
            {page} / {totalPages}
          </span>
          <button
            aria-label="다음 일괄 작업 페이지"
            className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
            disabled={page >= totalPages}
            type="button"
            onClick={() => onPageChange(page + 1)}
          >
            다음
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
