"use client";

import { useState } from "react";

import { useAudit, useAuditRetryDelivery, useAuditRollback } from "@/features/audit/hooks/useAudit";
import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import { AlertCircle, History, Loader2 } from "lucide-react";
import { AuditFeedbackBanner } from "./AuditFeedbackBanner";
import { AuditLogFilters } from "./AuditLogFilters";
import { AuditLogTable } from "./AuditLogTable";
import {
  type AuditFilterKey,
  type DeliveryProviderKey,
  type DeliveryStatusKey,
  type RollbackResourceType,
} from "./auditPageHelpers";

export default function AuditLogPage() {
  const [selectedFilter, setSelectedFilter] = useState<AuditFilterKey>("all");
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<DeliveryStatusKey>("all");
  const [selectedDeliveryProvider, setSelectedDeliveryProvider] = useState<DeliveryProviderKey>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [rollbackFeedback, setRollbackFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deliveryFeedback, setDeliveryFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);
  const [retryTargetId, setRetryTargetId] = useState<string | null>(null);
  const auditQuery =
    selectedFilter === "all"
      ? { limit: 50 }
      : selectedFilter === "security"
        ? { limit: 50, security_only: true }
        : selectedFilter === "alert_delivery"
          ? { limit: 50, action: "alert" }
          : selectedFilter === "settings_update"
            ? { limit: 50, resource_type: "settings", action: "update" }
            : selectedFilter === "settings_test"
              ? { limit: 50, resource_type: "settings", action: "test" }
              : selectedFilter === "settings_rollback"
                ? { limit: 50, resource_type: "settings", action: "rollback" }
                : { limit: 50, event: selectedFilter };
  const { data: logs, isLoading, isError, error } = useAudit({
    ...auditQuery,
    provider: selectedDeliveryProvider === "all" ? undefined : selectedDeliveryProvider,
    delivery_success:
      selectedDeliveryStatus === "all"
        ? undefined
        : selectedDeliveryStatus === "success",
  });
  const { data: timeDisplaySettings } = useTimeDisplaySettings();
  const rollbackMutation = useAuditRollback();
  const retryDeliveryMutation = useAuditRetryDelivery();

  const handleRollback = async (resourceType: RollbackResourceType, auditLogId: string) => {
    try {
      setRollbackTargetId(auditLogId);
      setRollbackFeedback(null);
      const result = await rollbackMutation.mutateAsync({ resourceType, auditLogId });
      const message =
        typeof result.message === "string" ? result.message : "대상 항목을 이전 상태로 되돌렸습니다.";
      setRollbackFeedback({ type: "success", text: message });
    } catch (rollbackError) {
      const message =
        (rollbackError as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "롤백에 실패했습니다.";
      setRollbackFeedback({ type: "error", text: message });
    } finally {
      setRollbackTargetId(null);
    }
  };

  const handleRetryDelivery = async (auditLogId: string) => {
    try {
      setRetryTargetId(auditLogId);
      setDeliveryFeedback(null);
      const result = await retryDeliveryMutation.mutateAsync({ auditLogId });
      setDeliveryFeedback({
        type: result.success ? "success" : "error",
        text: result.detail ? `${result.message} (${result.detail})` : result.message,
      });
    } catch (retryError) {
      const message =
        (retryError as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "알림 재시도에 실패했습니다.";
      setDeliveryFeedback({ type: "error", text: message });
    } finally {
      setRetryTargetId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="mb-4 h-8 w-8 animate-spin" />
        <p>감사 로그를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center px-6 text-center text-red-400">
        <AlertCircle className="mb-4 h-12 w-12 opacity-20" />
        <h3 className="mb-2 text-lg font-semibold">로그 로딩 오류</h3>
        <p className="max-w-md text-sm text-red-400/70">
          {error instanceof Error ? error.message : "감사 로그를 불러오지 못했습니다. 서버 연결 상태를 확인해주세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <History className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">감사 로그</h1>
          <p className="text-sm text-slate-500">시스템의 모든 변경 사항을 추적합니다.</p>
        </div>
      </div>

      <AuditLogFilters
        selectedFilter={selectedFilter}
        selectedDeliveryStatus={selectedDeliveryStatus}
        selectedDeliveryProvider={selectedDeliveryProvider}
        onFilterChange={setSelectedFilter}
        onDeliveryStatusChange={setSelectedDeliveryStatus}
        onDeliveryProviderChange={setSelectedDeliveryProvider}
      />

      <AuditFeedbackBanner feedback={rollbackFeedback} />
      <AuditFeedbackBanner feedback={deliveryFeedback} />

      <AuditLogTable
        logs={logs}
        timezone={timeDisplaySettings?.display_timezone}
        expandedLogId={expandedLogId}
        rollbackTargetId={rollbackTargetId}
        retryTargetId={retryTargetId}
        isRollbackPending={rollbackMutation.isPending}
        isRetryPending={retryDeliveryMutation.isPending}
        onExpandedLogChange={setExpandedLogId}
        onRollback={handleRollback}
        onRetryDelivery={handleRetryDelivery}
      />
    </div>
  );
}
