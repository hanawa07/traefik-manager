"use client";

import Link from "next/link";

import { useAuditRetryChain } from "@/features/audit/hooks/useAudit";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface AuditRetryChainPanelProps {
  enabled: boolean;
  logId: string;
  timezone?: string;
}

export function AuditRetryChainPanel({ enabled, logId, timezone }: AuditRetryChainPanelProps) {
  const chainQuery = useAuditRetryChain(logId, enabled);
  if (!enabled) return null;
  if (chainQuery.isLoading) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">재시도 체인 확인 중...</p>;
  }
  if (chainQuery.isError) {
    return <p className="text-xs text-rose-700 dark:text-rose-300">재시도 체인을 불러오지 못했습니다.</p>;
  }

  const chain = chainQuery.data ?? [];
  if (chain.length <= 1) return null;

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-950/20"
      data-chain-count={chain.length}
      data-testid="audit-retry-chain"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
        알림 재시도 체인 · {chain.length}건
      </p>
      <ol className="space-y-2 border-l-2 border-amber-200 pl-3 dark:border-amber-500/30">
        {chain.map((item, index) => {
          const success = item.detail?.success;
          const provider = item.detail?.provider;
          const parentId = item.detail?.retry_of_audit_id;
          const rawTrigger = item.detail?.trigger;
          const trigger = rawTrigger === "automatic_retry" || rawTrigger === "manual_retry"
            ? rawTrigger
            : null;
          const triggerLabel = trigger === "automatic_retry"
            ? "자동"
            : trigger === "manual_retry"
              ? "수동"
              : null;
          const isCurrent = item.id === logId;
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
              data-chain-audit-id={item.id}
              data-chain-current={isCurrent}
              data-chain-parent-id={typeof parentId === "string" ? parentId : undefined}
              data-chain-trigger={trigger || undefined}
            >
              <span className="font-semibold">{index === 0 ? "원본" : `재시도 ${index}`}</span>
              {triggerLabel ? (
                <span className={`rounded-full px-2 py-0.5 font-semibold ${trigger === "automatic_retry" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200" : "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200"}`}>
                  {triggerLabel}
                </span>
              ) : null}
              <span className={success === true ? "text-emerald-700 dark:text-emerald-300" : success === false ? "text-rose-700 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}>
                {success === true ? "성공" : success === false ? "실패" : "결과 없음"}
              </span>
              {typeof provider === "string" ? <span>{provider}</span> : null}
              <time className="text-slate-500 dark:text-slate-400" dateTime={item.created_at}>
                {formatDateTime(item.created_at, timezone)}
              </time>
              {isCurrent ? (
                <span className="rounded-full bg-amber-200 px-2 py-0.5 font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
                  현재 로그
                </span>
              ) : (
                <Link
                  className="ml-auto font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
                  href={`/dashboard/audit?q=${encodeURIComponent(item.id)}&expand=${encodeURIComponent(item.id)}`}
                >
                  감사 상세
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
