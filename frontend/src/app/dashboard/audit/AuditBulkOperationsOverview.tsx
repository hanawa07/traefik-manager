"use client";

import {
  BellOff,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Layers3,
  Loader2,
  RotateCw,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import {
  buildAuditExportUrl,
  type AuditBulkOperationSummary,
} from "@/features/audit/api/auditApi";
import { useAuditBulkOperations } from "@/features/audit/hooks/useAudit";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import {
  auditBulkNotificationStatusOptions,
  auditBulkPeriodOptions,
  type AuditBulkNotificationStatus,
  type AuditBulkPeriod,
} from "./auditPageHelpers";
import { AuditRetryChainPanel } from "./AuditRetryChainPanel";

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
            <BulkOperationCard
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

function BulkOperationCard({
  canManage,
  isRetryPending,
  onRetryDelivery,
  summary,
  timezone,
}: {
  canManage: boolean;
  isRetryPending: boolean;
  onRetryDelivery: (auditLogId: string) => void;
  summary: AuditBulkOperationSummary;
  timezone?: string;
}) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const exportUrl = buildAuditExportUrl({ bulk_operation_id: summary.operation_id });
  const serviceNames = summary.service_names.join(", ");
  const retryAuditId = summary.notification_audit_id;
  const retryHistoryAuditId = summary.notification_attempt_count > 1 ? retryAuditId : null;
  return (
    <article
      className="rounded-xl border border-cyan-100 bg-white/90 p-4 dark:border-cyan-500/20 dark:bg-slate-950/60"
      data-bulk-operation-id={summary.operation_id}
      data-notification-status={summary.notification_status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {getRoutingModeLabel(summary.routing_mode_after)} · {summary.service_count}개 서비스
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400" title={serviceNames}>
            {serviceNames}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <NotificationStatus summary={summary} />
          {canManage && summary.notification_status === "failure" && retryAuditId ? (
            <button
              className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-950"
              disabled={isRetryPending}
              type="button"
              onClick={() => onRetryDelivery(retryAuditId)}
            >
              {isRetryPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              전송 재시도
            </button>
          ) : null}
        </div>
      </div>
      {summary.last_failure_detail ? (
        <p
          className="mt-3 line-clamp-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          title={summary.last_failure_detail}
        >
          최근 실패 원인: {summary.last_failure_detail}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>{summary.actor}</span>
        <time dateTime={summary.completed_at}>{formatDateTime(summary.completed_at, timezone)}</time>
        {summary.notification_attempt_count > 0 ? (
          <span>전송 {summary.notification_attempt_count}회</span>
        ) : null}
        {retryHistoryAuditId ? (
          <button
            aria-label={`${summary.operation_id} 알림 재시도 전체 이력`}
            aria-expanded={isHistoryOpen}
            className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
            data-bulk-operation-history
            type="button"
            onClick={() => setIsHistoryOpen((current) => !current)}
          >
            {isHistoryOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {isHistoryOpen ? "이력 닫기" : "전체 이력"}
          </button>
        ) : null}
        <a
          aria-label={`${summary.service_count}개 서비스 일괄 변경 CSV 다운로드`}
          className="ml-auto inline-flex items-center gap-1 font-semibold text-cyan-700 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-100"
          download
          href={exportUrl}
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </a>
        <code className="w-full truncate text-[10px] text-slate-400 dark:text-slate-500" title={summary.operation_id}>
          {summary.operation_id}
        </code>
      </div>
      {retryHistoryAuditId && isHistoryOpen ? (
        <div className="mt-3">
          <AuditRetryChainPanel enabled logId={retryHistoryAuditId} timezone={timezone} />
        </div>
      ) : null}
    </article>
  );
}

function NotificationStatus({ summary }: { summary: AuditBulkOperationSummary }) {
  const config = {
    success: {
      Icon: CheckCircle2,
      label: "알림 성공",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    },
    failure: {
      Icon: XCircle,
      label: "알림 실패",
      className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    },
    none: {
      Icon: BellOff,
      label: "알림 기록 없음",
      className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
  }[summary.notification_status];
  const Icon = config.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${config.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
      {summary.notification_provider ? ` · ${summary.notification_provider}` : ""}
    </span>
  );
}

function getRoutingModeLabel(routingMode: string | null) {
  if (routingMode === "active") return "정상 운영 전환";
  if (routingMode === "disabled") return "라우팅 비활성 전환";
  if (routingMode === "maintenance") return "점검 안내 전환";
  return "운영 상태 일괄 변경";
}
