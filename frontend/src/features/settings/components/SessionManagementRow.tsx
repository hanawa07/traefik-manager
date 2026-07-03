import { Laptop, LogOut } from "lucide-react";

import type { SessionInfoResponse } from "@/features/auth/api/authApi";
import { SettingsSummaryRow } from "@/features/settings/components/SettingsCardPrimitives";
import { formatDateTime } from "@/shared/lib/dateTimeFormat";

interface SessionManagementRowProps {
  isRevoking: boolean;
  onRevoke: (sessionId: string, isCurrent: boolean) => void;
  session: SessionInfoResponse;
  timezone?: string;
}

export function SessionManagementRow({
  isRevoking,
  onRevoke,
  session,
  timezone,
}: SessionManagementRowProps) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        session.is_current ? "border-amber-300 bg-amber-50/70" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <Laptop className="h-4 w-4 text-gray-500" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
              {session.user_agent || "알 수 없는 브라우저"}
            </span>
            {session.is_current ? <CurrentSessionBadge /> : null}
          </div>

          <SessionMetadataGrid session={session} timezone={timezone} />
        </div>

        <button
          type="button"
          className="btn-secondary inline-flex shrink-0 items-center gap-2 py-1.5 text-xs"
          onClick={() => onRevoke(session.session_id, session.is_current)}
          disabled={isRevoking}
        >
          <LogOut className="h-3.5 w-3.5" />
          {session.is_current ? "현재 세션 종료" : "세션 종료"}
        </button>
      </div>
    </div>
  );
}

function CurrentSessionBadge() {
  return (
    <span
      className={
        "shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 " +
        "text-[11px] font-semibold text-amber-800"
      }
    >
      현재 세션
    </span>
  );
}

function SessionMetadataGrid({
  session,
  timezone,
}: {
  session: SessionInfoResponse;
  timezone?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-600 md:grid-cols-2">
      <SettingsSummaryRow label="세션 ID" value={session.session_id} mono />
      <SettingsSummaryRow label="IP" value={session.ip_address || "-"} mono />
      <SettingsSummaryRow label="발급 시각" value={formatDateTime(session.issued_at, timezone)} />
      <SettingsSummaryRow label="최근 활동" value={formatDateTime(session.last_seen_at, timezone)} />
      <SettingsSummaryRow label="절대 만료" value={formatDateTime(session.expires_at, timezone)} />
      <SettingsSummaryRow
        label="유휴 만료"
        value={formatDateTime(session.idle_expires_at, timezone)}
      />
    </div>
  );
}
