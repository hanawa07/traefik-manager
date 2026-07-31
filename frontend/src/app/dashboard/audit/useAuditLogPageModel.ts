"use client";

import { buildAuditExportUrl, type AuditLogItem } from "@/features/audit/api/auditApi";
import { useAuditPage, useManagerHealthSummary } from "@/features/audit/hooks/useAudit";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";

import { isManagerHttpErrorEvent, isManagerHttpLogStorageEvent } from "./auditPageHelpers";
import { useAuditLogActions } from "./useAuditLogActions";
import { withoutAuditPagination } from "./auditPageQuery";
import { useAuditLogQueryState } from "./useAuditLogQueryState";

const FALLBACK_AUDIT_LOAD_ERROR = "감사 로그를 불러오지 못했습니다. 서버 연결 상태를 확인해주세요.";

export function useAuditLogPageModel() {
  const queryState = useAuditLogQueryState();
  const exportUrl = buildAuditExportUrl(withoutAuditPagination(queryState.auditQuery));
  const { data: logPage, isLoading, isFetching, isError, error } = useAuditPage(queryState.auditQuery);
  const { data: delayedRetryPage } = useAuditPage({ limit: 1, offset: 0, retry_delay: "delayed" });
  const { data: managerHealthSummary } = useManagerHealthSummary(
    queryState.filters.managerHealthWindowMinutes,
  );
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const auditActions = useAuditLogActions();
  const autoExpandedLogId =
    queryState.requestedExpandedLogId === "latest"
      ? logPage?.items.find(isManagerHttpLog)?.id
      : queryState.requestedExpandedLogId === "first"
        ? logPage?.items[0]?.id
        : queryState.requestedExpandedLogId;
  const visibleExpandedLogId = queryState.table.expandedLogId === undefined
    ? autoExpandedLogId ?? null
    : queryState.table.expandedLogId;

  return {
    bulkOperations: queryState.bulkOperations,
    deliveryFeedback: auditActions.deliveryFeedback,
    errorMessage: error instanceof Error ? error.message : FALLBACK_AUDIT_LOAD_ERROR,
    exportUrl,
    filters: {
      ...queryState.filters,
      delayedRetryCount: delayedRetryPage?.total,
      managerHealthCounts: managerHealthSummary,
    },
    isError,
    isLoading,
    rollbackFeedback: auditActions.rollbackFeedback,
    trend: queryState.trend,
    table: {
      ...queryState.table,
      expandedLogId: visibleExpandedLogId,
      isRetryPending: auditActions.isRetryPending,
      isRefreshing: isFetching && !isLoading,
      isRollbackPending: auditActions.isRollbackPending,
      logs: logPage?.items,
      retryTargetId: auditActions.retryTargetId,
      rollbackTargetId: auditActions.rollbackTargetId,
      timezone: timeDisplaySettings?.display_timezone,
      totalCount: logPage?.total || 0,
      onRetryDelivery: auditActions.onRetryDelivery,
      onRollback: auditActions.onRollback,
    },
  };
}

function isManagerHttpLog(log: AuditLogItem) {
  return (
    isManagerHttpErrorEvent(log.event) ||
    isManagerHttpErrorEvent(log.detail?.event) ||
    isManagerHttpLogStorageEvent(log.event) ||
    isManagerHttpLogStorageEvent(log.detail?.event)
  );
}
