"use client";

import { BellOff, CheckCircle2, Download, Layers3, XCircle } from "lucide-react";

import {
  buildAuditExportUrl,
  type AuditBulkOperationSummary,
} from "@/features/audit/api/auditApi";
import { useAuditBulkOperations } from "@/features/audit/hooks/useAudit";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

export function AuditBulkOperationsOverview({ timezone }: { timezone?: string }) {
  const query = useAuditBulkOperations();
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
  if (!query.data?.length) return null;

  return (
    <section
      className="mb-6 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-sm dark:border-cyan-500/25 dark:from-cyan-950/30 dark:via-slate-900 dark:to-sky-950/20 dark:shadow-none"
      data-testid="audit-bulk-operations-overview"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950">
          <Layers3 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-bold text-slate-950 dark:text-slate-100">최근 서비스 일괄 작업</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            같은 작업 ID의 변경 기록과 알림 결과를 한 장으로 묶었습니다.
          </p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {query.data.map((summary) => (
          <BulkOperationCard key={summary.operation_id} summary={summary} timezone={timezone} />
        ))}
      </div>
    </section>
  );
}

function BulkOperationCard({
  summary,
  timezone,
}: {
  summary: AuditBulkOperationSummary;
  timezone?: string;
}) {
  const exportUrl = buildAuditExportUrl({ bulk_operation_id: summary.operation_id });
  const serviceNames = summary.service_names.join(", ");
  return (
    <article
      className="rounded-xl border border-cyan-100 bg-white/90 p-4 dark:border-cyan-500/20 dark:bg-slate-950/60"
      data-bulk-operation-id={summary.operation_id}
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
        <NotificationStatus summary={summary} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>{summary.actor}</span>
        <time dateTime={summary.completed_at}>{formatDateTime(summary.completed_at, timezone)}</time>
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
