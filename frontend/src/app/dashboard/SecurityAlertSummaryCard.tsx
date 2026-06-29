import { AlertTriangle, Lock, Server, Shield } from "lucide-react";
import Link from "next/link";

import type { AuditSecuritySummary } from "@/features/audit/api/auditApi";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";
import { DashboardStatCard } from "./DashboardStatCard";

interface SecurityAlertSummaryCardProps {
  summary?: AuditSecuritySummary;
  timezone?: string;
}

export function SecurityAlertSummaryCard({ summary, timezone }: SecurityAlertSummaryCardProps) {
  return (
    <div className="card mb-6 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">보안 경고 요약</h2>
          <p className="mt-1 text-xs text-gray-500">
            최근 {formatDurationMinutes(summary?.window_minutes ?? 1440)} 기준 로그인 방어 이벤트 요약입니다.
          </p>
        </div>
        <Link href="/dashboard/audit" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          감사 로그 보기
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardStatCard icon={AlertTriangle} label="로그인 실패" value={summary?.failed_login_count ?? 0} color="bg-slate-500" />
        <DashboardStatCard icon={Lock} label="계정 잠금" value={summary?.locked_login_count ?? 0} color="bg-amber-500" />
        <DashboardStatCard icon={Shield} label="이상 징후" value={summary?.suspicious_ip_count ?? 0} color="bg-orange-500" />
        <DashboardStatCard icon={Server} label="IP 차단" value={summary?.blocked_ip_count ?? 0} color="bg-rose-500" />
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-gray-900">최근 보안 이벤트</h3>
          <span className="text-xs text-gray-500">잠금/이상 징후/IP 차단만 표시</span>
        </div>
        {!summary?.recent_events?.length ? (
          <p className="text-sm text-gray-500">최근 보안 경고가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {summary.recent_events.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {getSecurityEventLabel(event.event)}
                    <span className="ml-2 font-normal text-gray-600">{event.resource_name}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    actor {event.actor}
                    {event.client_ip ? ` · IP ${event.client_ip}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">{formatDateTime(event.created_at, timezone)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getSecurityEventLabel(event: string) {
  if (event === "login_blocked_ip") return "IP 차단";
  if (event === "login_suspicious") return "이상 징후";
  return "계정 잠금";
}
