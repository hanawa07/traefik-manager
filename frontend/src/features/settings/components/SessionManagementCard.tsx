import { ShieldCheck } from "lucide-react";

import type { SessionInfoResponse } from "@/features/auth/api/authApi";
import { SessionLogoutAllButton } from "@/features/settings/components/SessionLogoutAllButton";
import { SessionManagementList } from "@/features/settings/components/SessionManagementList";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";

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
    <div className="card order-5 h-full p-6">
      <SettingsCardHeader
        icon={<ShieldCheck className="h-5 w-5 text-amber-600" />}
        title="세션 관리"
        description="현재 로그인된 브라우저 세션을 확인하고, 필요하면 개별 종료 또는 전체 로그아웃할 수 있습니다."
        action={
          <SessionLogoutAllButton
            disabled={isLoggingOutAll || isLoading || !sessions.length}
            isLoggingOutAll={isLoggingOutAll}
            onLogoutAll={onLogoutAll}
          />
        }
      />

      <SessionManagementList
        isLoading={isLoading}
        isRevokingSession={isRevokingSession}
        onRevokeSession={onRevokeSession}
        sessions={sessions}
        timezone={timezone}
      />
    </div>
  );
}
