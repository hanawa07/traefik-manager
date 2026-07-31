"use client";

import {
  BellOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  RotateCw,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import {
  buildAuditExportUrl,
  type AuditBulkOperationSummary,
} from "@/features/audit/api/auditApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

import { AuditRetryChainPanel } from "./AuditRetryChainPanel";

interface AuditBulkOperationCardProps {
  canManage: boolean;
  isRetryPending: boolean;
  onRetryDelivery: (auditLogId: string) => void;
  summary: AuditBulkOperationSummary;
  timezone?: string;
}

export function AuditBulkOperationCard({
  canManage,
  isRetryPending,
  onRetryDelivery,
  summary,
  timezone,
}: AuditBulkOperationCardProps) {
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
          <p
            className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400"
            title={serviceNames}
          >
            {serviceNames}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <NotificationStatus summary={summary} />
          {canManage && summary.notification_status === "failure" && retryAuditId ? (
            <button
              className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-950"
              disabled={isRetryPending}
              onClick={() => onRetryDelivery(retryAuditId)}
              type="button"
            >
              {isRetryPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" />
              )}
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
        <time dateTime={summary.completed_at}>
          {formatDateTime(summary.completed_at, timezone)}
        </time>
        {summary.notification_attempt_count > 0 ? (
          <span>전송 {summary.notification_attempt_count}회</span>
        ) : null}
        {retryHistoryAuditId ? (
          <button
            aria-expanded={isHistoryOpen}
            aria-label={`${summary.operation_id} 알림 재시도 전체 이력`}
            className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
            data-bulk-operation-history
            onClick={() => setIsHistoryOpen((current) => !current)}
            type="button"
          >
            {isHistoryOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
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
        <code
          className="w-full truncate text-[10px] text-slate-400 dark:text-slate-500"
          title={summary.operation_id}
        >
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
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    },
    failure: {
      Icon: XCircle,
      label: "알림 실패",
      className:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    },
    none: {
      Icon: BellOff,
      label: "알림 기록 없음",
      className:
        "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
  }[summary.notification_status];
  const Icon = config.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${config.className}`}
    >
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
