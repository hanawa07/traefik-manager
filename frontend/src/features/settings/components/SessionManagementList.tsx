import type { SessionInfoResponse } from "@/features/auth/api/authApi";

import { SessionManagementRow } from "@/features/settings/components/SessionManagementRow";

interface SessionManagementListProps {
  isLoading: boolean;
  isRevokingSession: boolean;
  onRevokeSession: (sessionId: string, isCurrent: boolean) => void;
  sessions: SessionInfoResponse[];
  timezone?: string;
}

export function SessionManagementList({
  isLoading,
  isRevokingSession,
  onRevokeSession,
  sessions,
  timezone,
}: SessionManagementListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div
        className={
          "rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 " +
          "text-center text-sm text-gray-500"
        }
      >
        활성 세션이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <SessionManagementRow
          key={session.session_id}
          session={session}
          timezone={timezone}
          isRevoking={isRevokingSession}
          onRevoke={onRevokeSession}
        />
      ))}
    </div>
  );
}
