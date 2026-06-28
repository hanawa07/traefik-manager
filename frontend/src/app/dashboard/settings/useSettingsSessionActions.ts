import { useRouter } from "next/navigation";

import { useLogoutAllSessions, useRevokeSession, useSessions } from "@/features/auth/hooks/useSessions";
import { useAuthStore } from "@/features/auth/store/useAuthStore";

export function useSettingsSessionActions() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const { data: sessionData, isLoading: isSessionsLoading } = useSessions();
  const logoutAllSessions = useLogoutAllSessions();
  const revokeSession = useRevokeSession();

  const handleLogoutAllSessions = async () => {
    await logoutAllSessions.mutateAsync();
    clearSession();
    router.push("/login");
  };

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    await revokeSession.mutateAsync(sessionId);
    if (isCurrent) {
      clearSession();
      router.push("/login");
    }
  };

  return {
    sessionData,
    isSessionsLoading,
    isLoggingOutAll: logoutAllSessions.isPending,
    isRevokingSession: revokeSession.isPending,
    handleLogoutAllSessions,
    handleRevokeSession,
  };
}
