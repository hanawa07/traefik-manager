import { Laptop, LogOut, ShieldCheck } from "lucide-react";

import type { SessionInfoResponse } from "@/features/auth/api/authApi";
import {
  SettingsCardHeader,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface SessionManagementCardProps {
  isLoading: boolean;
  sessions?: SessionInfoResponse[];
  timezone?: string;
  isLoggingOutAll: boolean;
  isRevokingSession: boolean;
  onLogoutAll: () => void;
  onRevokeSession: (sessionId: string, isCurrent: boolean) => void;
}

export function SessionManagementCard({
  isLoading,
  sessions = [],
  timezone,
  isLoggingOutAll,
  isRevokingSession,
  onLogoutAll,
  onRevokeSession,
}: SessionManagementCardProps) {
  return (
    <div className="card p-6 h-full order-5">
      <SettingsCardHeader
        icon={<ShieldCheck className="w-5 h-5 text-amber-600" />}
        title="세션 관리"
        description="현재 로그인된 브라우저 세션을 확인하고, 필요하면 개별 종료 또는 전체 로그아웃할 수 있습니다."
        action={
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
            onClick={onLogoutAll}
            disabled={isLoggingOutAll || isLoading || !sessions.length}
          >
            <LogOut className="h-3.5 w-3.5" />
            {isLoggingOutAll ? "로그아웃 중..." : "모든 세션 로그아웃"}
          </button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      ) : !sessions.length ? (
        <div
          className={
            "rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 " +
            "text-center text-sm text-gray-500"
          }
        >
          활성 세션이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionRow
              key={session.session_id}
              session={session}
              timezone={timezone}
              isRevoking={isRevokingSession}
              onRevoke={onRevokeSession}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session,
  timezone,
  isRevoking,
  onRevoke,
}: {
  session: SessionInfoResponse;
  timezone?: string;
  isRevoking: boolean;
  onRevoke: (sessionId: string, isCurrent: boolean) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        session.is_current ? "border-amber-300 bg-amber-50/70" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <Laptop className="w-4 h-4 text-gray-500" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
              {session.user_agent || "알 수 없는 브라우저"}
            </span>
            {session.is_current ? (
              <span
                className={
                  "shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 " +
                  "text-[11px] font-semibold text-amber-800"
                }
              >
                현재 세션
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
            <SettingsSummaryRow label="세션 ID" value={session.session_id} mono />
            <SettingsSummaryRow label="IP" value={session.ip_address || "-"} mono />
            <SettingsSummaryRow
              label="발급 시각"
              value={formatDateTime(session.issued_at, timezone)}
            />
            <SettingsSummaryRow
              label="최근 활동"
              value={formatDateTime(session.last_seen_at, timezone)}
            />
            <SettingsSummaryRow
              label="절대 만료"
              value={formatDateTime(session.expires_at, timezone)}
            />
            <SettingsSummaryRow
              label="유휴 만료"
              value={formatDateTime(session.idle_expires_at, timezone)}
            />
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2 text-xs py-1.5 shrink-0"
          onClick={() => onRevoke(session.session_id, session.is_current)}
          disabled={isRevoking}
        >
          <LogOut className="w-3.5 h-3.5" />
          {session.is_current ? "현재 세션 종료" : "세션 종료"}
        </button>
      </div>
    </div>
  );
}
