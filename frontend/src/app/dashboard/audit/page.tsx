"use client";

import { Fragment, useState } from "react";

import { useTimeDisplaySettings } from "@/features/settings/hooks/useSettings";
import { useAudit, useAuditRetryDelivery, useAuditRollback } from "@/features/audit/hooks/useAudit";
import { 
  History, 
  Server, 
  ArrowRightLeft, 
  SlidersHorizontal, 
  User, 
  AlertCircle,
  Loader2,
  Shield,
} from "lucide-react";
import { clsx } from "clsx";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

const resourceTypeConfig = {
  service: { icon: Server, label: "서비스", color: "text-blue-200 bg-blue-500/20" },
  redirect: { icon: ArrowRightLeft, label: "리다이렉트", color: "text-purple-200 bg-purple-500/20" },
  middleware: { icon: SlidersHorizontal, label: "미들웨어", color: "text-orange-200 bg-orange-500/20" },
  user: { icon: User, label: "사용자", color: "text-emerald-200 bg-emerald-500/20" },
  settings: { icon: SlidersHorizontal, label: "설정", color: "text-cyan-200 bg-cyan-500/20" },
  certificate: { icon: Shield, label: "인증서", color: "text-amber-200 bg-amber-500/20" },
};

const actionConfig = {
  create: { label: "생성", color: "bg-green-600/20 text-green-300 border-green-500/30" },
  update: { label: "수정", color: "bg-blue-600/20 text-blue-300 border-blue-500/30" },
  delete: { label: "삭제", color: "bg-red-600/20 text-red-300 border-red-500/30" },
  test: { label: "테스트", color: "bg-cyan-600/20 text-cyan-200 border-cyan-500/30" },
  alert: { label: "경고", color: "bg-amber-600/20 text-amber-200 border-amber-500/30" },
  rollback: { label: "롤백", color: "bg-amber-600/20 text-amber-200 border-amber-500/30" },
};

const securityEventConfig = {
  login_failure: { label: "로그인 실패", color: "bg-slate-700 text-slate-100 border-slate-600" },
  login_locked: { label: "계정 잠금", color: "bg-amber-600/20 text-amber-200 border-amber-500/30" },
  login_suspicious: { label: "이상 징후", color: "bg-orange-600/20 text-orange-200 border-orange-500/30" },
  login_blocked_ip: { label: "IP 차단", color: "bg-red-600/20 text-red-200 border-red-500/30" },
  settings_update_cloudflare: { label: "Cloudflare 설정 변경", color: "bg-cyan-600/20 text-cyan-200 border-cyan-500/30" },
  settings_update_time_display: { label: "시간 표시 설정 변경", color: "bg-sky-600/20 text-sky-200 border-sky-500/30" },
  settings_update_certificate_diagnostics: { label: "인증서 진단 설정 변경", color: "bg-violet-600/20 text-violet-200 border-violet-500/30" },
  settings_update_upstream_security: { label: "업스트림 보안 설정 변경", color: "bg-indigo-600/20 text-indigo-200 border-indigo-500/30" },
  settings_update_login_defense: { label: "로그인 방어 설정 변경", color: "bg-violet-600/20 text-violet-200 border-violet-500/30" },
  settings_update_security_alert: { label: "보안 알림 설정 변경", color: "bg-fuchsia-600/20 text-fuchsia-200 border-fuchsia-500/30" },
  settings_rollback_time_display: { label: "시간 표시 설정 롤백", color: "bg-amber-600/20 text-amber-200 border-amber-500/30" },
  settings_rollback_upstream_security: { label: "업스트림 보안 설정 롤백", color: "bg-orange-600/20 text-orange-200 border-orange-500/30" },
  settings_test_cloudflare: { label: "Cloudflare 테스트", color: "bg-cyan-600/20 text-cyan-200 border-cyan-500/30" },
  settings_test_cloudflare_drift: { label: "Cloudflare 드리프트 진단", color: "bg-sky-600/20 text-sky-200 border-sky-500/30" },
  settings_test_cloudflare_reconcile: { label: "Cloudflare 재동기화", color: "bg-blue-600/20 text-blue-200 border-blue-500/30" },
  settings_test_security_alert: { label: "보안 알림 테스트", color: "bg-sky-600/20 text-sky-200 border-sky-500/30" },
  security_alert_delivery_success: { label: "보안 알림 전송 성공", color: "bg-emerald-600/20 text-emerald-200 border-emerald-500/30" },
  security_alert_delivery_failure: { label: "보안 알림 전송 실패", color: "bg-rose-600/20 text-rose-200 border-rose-500/30" },
  change_alert_delivery_success: { label: "운영 변경 알림 전송 성공", color: "bg-teal-600/20 text-teal-200 border-teal-500/30" },
  change_alert_delivery_failure: { label: "운영 변경 알림 전송 실패", color: "bg-red-600/20 text-red-200 border-red-500/30" },
  service_create: { label: "서비스 생성", color: "bg-sky-600/20 text-sky-200 border-sky-500/30" },
  service_update: { label: "서비스 변경", color: "bg-blue-600/20 text-blue-200 border-blue-500/30" },
  service_delete: { label: "서비스 삭제", color: "bg-red-600/20 text-red-200 border-red-500/30" },
  service_rollback: { label: "서비스 롤백", color: "bg-indigo-600/20 text-indigo-200 border-indigo-500/30" },
  redirect_create: { label: "리다이렉트 생성", color: "bg-violet-600/20 text-violet-200 border-violet-500/30" },
  redirect_update: { label: "리다이렉트 변경", color: "bg-purple-600/20 text-purple-200 border-purple-500/30" },
  redirect_delete: { label: "리다이렉트 삭제", color: "bg-pink-600/20 text-pink-200 border-pink-500/30" },
  redirect_rollback: { label: "리다이렉트 롤백", color: "bg-fuchsia-600/20 text-fuchsia-200 border-fuchsia-500/30" },
  middleware_create: { label: "미들웨어 생성", color: "bg-orange-500/20 text-orange-200 border-orange-400/30" },
  middleware_update: { label: "미들웨어 변경", color: "bg-orange-600/20 text-orange-200 border-orange-500/30" },
  middleware_delete: { label: "미들웨어 삭제", color: "bg-red-600/20 text-red-200 border-red-500/30" },
  middleware_rollback: { label: "미들웨어 롤백", color: "bg-amber-600/20 text-amber-200 border-amber-500/30" },
  user_create: { label: "사용자 생성", color: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30" },
  user_update: { label: "사용자 변경", color: "bg-emerald-600/20 text-emerald-200 border-emerald-500/30" },
  user_delete: { label: "사용자 삭제", color: "bg-rose-600/20 text-rose-200 border-rose-500/30" },
  user_rollback: { label: "사용자 롤백", color: "bg-lime-600/20 text-lime-200 border-lime-500/30" },
  certificate_warning: { label: "인증서 만료 임박", color: "bg-yellow-600/20 text-yellow-200 border-yellow-500/30" },
  certificate_error: { label: "인증서 만료", color: "bg-red-600/20 text-red-200 border-red-500/30" },
  certificate_recovered: { label: "인증서 복구", color: "bg-emerald-600/20 text-emerald-200 border-emerald-500/30" },
  certificate_preflight: { label: "인증서 사전 진단", color: "bg-blue-600/20 text-blue-200 border-blue-500/30" },
  certificate_preflight_repeated_failure: { label: "인증서 반복 실패", color: "bg-rose-600/20 text-rose-200 border-rose-500/30" },
};

const auditFilters = [
  { key: "all", label: "전체" },
  { key: "security", label: "보안 이벤트" },
  { key: "alert_delivery", label: "알림 전송" },
  { key: "settings_update", label: "설정 변경" },
  { key: "settings_test", label: "설정 테스트" },
  { key: "settings_rollback", label: "설정 롤백" },
  { key: "login_locked", label: "계정 잠금" },
  { key: "login_suspicious", label: "이상 징후" },
  { key: "login_blocked_ip", label: "IP 차단" },
  { key: "login_failure", label: "로그인 실패" },
  { key: "certificate_warning", label: "인증서 만료 임박" },
  { key: "certificate_error", label: "인증서 만료" },
  { key: "certificate_recovered", label: "인증서 복구" },
  { key: "certificate_preflight", label: "인증서 사전 진단" },
  { key: "certificate_preflight_repeated_failure", label: "인증서 반복 실패" },
] as const;

const deliveryStatusOptions = [
  { key: "all", label: "전송 상태 전체" },
  { key: "success", label: "전송 성공" },
  { key: "failure", label: "전송 실패" },
] as const;

const deliveryProviderOptions = [
  { key: "all", label: "채널 전체" },
  { key: "generic", label: "Generic" },
  { key: "slack", label: "Slack" },
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
  { key: "teams", label: "Teams" },
  { key: "pagerduty", label: "PagerDuty" },
  { key: "email", label: "Email" },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "없음";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function getAuditDiffRows(detail: Record<string, unknown> | null) {
  if (!detail) return [];
  const before = isRecord(detail.before) ? detail.before : null;
  const after = isRecord(detail.after) ? detail.after : null;
  if (!before || !after) return [];

  const changedKeys = Array.isArray(detail.changed_keys)
    ? detail.changed_keys.filter((item): item is string => typeof item === "string")
    : Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return changedKeys.map((key) => ({
    key,
    before: before[key],
    after: after[key],
  }));
}

function getDeliveryDetailRows(detail: Record<string, unknown> | null) {
  if (!detail) return [];
  const rows = [
    { key: "provider", label: "채널", value: detail.provider },
    { key: "source_event", label: "원본 이벤트", value: detail.source_event },
    { key: "source_action", label: "원본 작업", value: detail.source_action },
    { key: "source_resource_type", label: "원본 타입", value: detail.source_resource_type },
    { key: "source_resource_name", label: "원본 이름", value: detail.source_resource_name },
    { key: "client_ip", label: "IP", value: detail.client_ip },
    { key: "detail", label: "전송 상세", value: detail.detail },
    { key: "retry_of_audit_id", label: "재시도 원본", value: detail.retry_of_audit_id },
    { key: "trigger", label: "트리거", value: detail.trigger },
  ];
  return rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "");
}

export default function AuditLogPage() {
  const [selectedFilter, setSelectedFilter] = useState<(typeof auditFilters)[number]["key"]>("all");
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<(typeof deliveryStatusOptions)[number]["key"]>("all");
  const [selectedDeliveryProvider, setSelectedDeliveryProvider] = useState<(typeof deliveryProviderOptions)[number]["key"]>("all");
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

  const handleRollback = async (
    resourceType: "settings" | "service" | "redirect" | "middleware" | "user",
    auditLogId: string,
  ) => {
    try {
      setRollbackTargetId(auditLogId);
      setRollbackFeedback(null);
      const result = await rollbackMutation.mutateAsync({ resourceType, auditLogId });
      const message =
        typeof result.message === "string"
          ? result.message
          : "대상 항목을 이전 상태로 되돌렸습니다.";
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
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>감사 로그를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-red-400 px-6 text-center">
        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-lg font-semibold mb-2">로그 로딩 오류</h3>
        <p className="text-sm text-red-400/70 max-w-md">
          {error instanceof Error ? error.message : "감사 로그를 불러오지 못했습니다. 서버 연결 상태를 확인해주세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-lg border border-slate-700">
          <History className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">감사 로그</h1>
          <p className="text-slate-400 text-sm">시스템의 모든 변경 사항을 추적합니다.</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {auditFilters.map((filter) => {
          const active = selectedFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setSelectedFilter(filter.key)}
              className={clsx(
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-blue-400 bg-blue-300 text-slate-950"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500",
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
          <span className="text-slate-400">전송 상태</span>
          <select
            value={selectedDeliveryStatus}
            onChange={(event) => setSelectedDeliveryStatus(event.target.value as (typeof deliveryStatusOptions)[number]["key"])}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
          >
            {deliveryStatusOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
          <span className="text-slate-400">채널</span>
          <select
            value={selectedDeliveryProvider}
            onChange={(event) => setSelectedDeliveryProvider(event.target.value as (typeof deliveryProviderOptions)[number]["key"])}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
          >
            {deliveryProviderOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rollbackFeedback ? (
        <div
          className={clsx(
            "mb-4 rounded-xl border px-4 py-3 text-sm",
            rollbackFeedback.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-100"
              : "border-red-500/30 bg-red-500/10 text-red-100",
          )}
        >
          {rollbackFeedback.text}
        </div>
      ) : null}

      {deliveryFeedback ? (
        <div
          className={clsx(
            "mb-4 rounded-xl border px-4 py-3 text-sm",
            deliveryFeedback.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-100"
              : "border-red-500/30 bg-red-500/10 text-red-100",
          )}
        >
          {deliveryFeedback.text}
        </div>
      ) : null}

      <div className="bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900">
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">사용자</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">이벤트</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">작업</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">대상 타입</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">대상 이름</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">발생 시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {!logs || logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-300">
                    기록된 감사 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const resource = resourceTypeConfig[log.resource_type as keyof typeof resourceTypeConfig];
                  const action = actionConfig[log.action as keyof typeof actionConfig];
                  const event = log.event ? securityEventConfig[log.event as keyof typeof securityEventConfig] : null;
                  const ResourceIcon = resource?.icon || Server;
                  const detail = isRecord(log.detail) ? log.detail : null;
                  const diffRows = getAuditDiffRows(detail);
                  const deliveryRows = getDeliveryDetailRows(detail);
                  const retrySupported = log.event?.endsWith("_delivery_failure") === true;
                  const canExpand = diffRows.length > 0 || deliveryRows.length > 0;
                  const rollbackSupported =
                    detail?.rollback_supported === true &&
                    log.action === "update" &&
                    (
                      log.resource_type === "settings" ||
                      log.resource_type === "service" ||
                      log.resource_type === "redirect" ||
                      log.resource_type === "middleware" ||
                      log.resource_type === "user"
                    );
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <Fragment key={log.id}>
                      <tr key={log.id} className="hover:bg-slate-900 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600">
                              <span className="text-xs text-white font-black">
                                {log.actor.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm text-white font-semibold">{log.actor}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {event ? (
                            <span
                              className={clsx(
                                "px-2.5 py-1 rounded-md text-[11px] font-black border",
                                event.color,
                              )}
                            >
                              {event.label}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={clsx(
                            "px-2.5 py-1 rounded-md text-[11px] font-black border",
                            action?.color || "bg-slate-800 text-white border-slate-700"
                          )}>
                            {action?.label || log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={clsx("p-1.5 rounded-lg", resource?.color)}>
                              <ResourceIcon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm text-white font-medium">{resource?.label || log.resource_type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <span className="block text-sm text-white font-bold group-hover:text-blue-400 transition-colors">
                              {log.resource_name}
                            </span>
                            {canExpand ? (
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className="text-xs font-medium text-blue-300 hover:text-blue-200"
                              >
                                {isExpanded ? "상세 숨기기" : "상세 보기"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-100 font-medium">
                            {formatDateTime(log.created_at, timeDisplaySettings?.display_timezone)}
                          </span>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-slate-900/60">
                          <td colSpan={6} className="px-6 py-5">
                            <div className="space-y-4">
                              {diffRows.length > 0 ? (
                                <>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {diffRows.map((row) => (
                                      <span
                                        key={`${log.id}-${row.key}`}
                                        className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] font-medium text-slate-300"
                                      >
                                        {row.key}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="grid gap-4 xl:grid-cols-2">
                                    <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4">
                                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        이전 값
                                      </p>
                                      <div className="space-y-2">
                                        {diffRows.map((row) => (
                                          <div key={`${log.id}-${row.key}-before`} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
                                            <span className="text-slate-400">{row.key}</span>
                                            <span className="break-all text-slate-100">{formatAuditValue(row.before)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4">
                                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        이후 값
                                      </p>
                                      <div className="space-y-2">
                                        {diffRows.map((row) => (
                                          <div key={`${log.id}-${row.key}-after`} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
                                            <span className="text-slate-400">{row.key}</span>
                                            <span className="break-all text-slate-100">{formatAuditValue(row.after)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : null}
                              {deliveryRows.length > 0 ? (
                                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4">
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    전송 상세
                                  </p>
                                  <div className="space-y-2">
                                    {deliveryRows.map((row) => (
                                      <div key={`${log.id}-${row.key}-delivery`} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
                                        <span className="text-slate-400">{row.label}</span>
                                        <span className="break-all text-slate-100">{formatAuditValue(row.value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {rollbackSupported ? (
                                <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                                  <p className="text-sm text-amber-100">
                                    이 변경은 안전 롤백을 지원합니다. 저장된 이전 상태로 되돌립니다.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRollback(
                                        log.resource_type as "settings" | "service" | "redirect" | "middleware" | "user",
                                        log.id,
                                      )
                                    }
                                    disabled={rollbackMutation.isPending}
                                    className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {rollbackMutation.isPending && rollbackTargetId === log.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : null}
                                    이전 상태로 롤백
                                  </button>
                                </div>
                              ) : null}
                              {retrySupported ? (
                                <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                                  <p className="text-sm text-rose-100">
                                    실패한 알림 전송입니다. 현재 채널 설정으로 다시 시도할 수 있습니다.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleRetryDelivery(log.id)}
                                    disabled={retryDeliveryMutation.isPending}
                                    className="inline-flex items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {retryDeliveryMutation.isPending && retryTargetId === log.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : null}
                                    전송 재시도
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
