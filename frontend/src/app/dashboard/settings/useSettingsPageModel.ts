import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useBackupRestoreSettings } from "@/features/settings/hooks/useBackupRestoreSettings";
import { useCloudflareDnsSettingsSection } from "@/features/settings/hooks/useCloudflareDnsSettingsSection";
import { useCertificateDiagnosticsSettingsModel } from "./useCertificateDiagnosticsSettingsModel";
import { useLoginDefenseSettingsModel } from "./useLoginDefenseSettingsModel";
import { useSecurityAlertSettingsModel } from "./useSecurityAlertSettingsModel";
import { useSettingsSessionActions } from "./useSettingsSessionActions";
import { useTimeDisplaySettingsModel } from "./useTimeDisplaySettingsModel";
import { useTraefikDashboardSettingsModel } from "./useTraefikDashboardSettingsModel";
import { useUpstreamSecuritySettingsModel } from "./useUpstreamSecuritySettingsModel";

export function useSettingsPageModel() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const timeDisplay = useTimeDisplaySettingsModel(canManage);
  const {
    sessionData,
    isSessionsLoading,
    isLoggingOutAll,
    isRevokingSession,
    handleLogoutAllSessions,
    handleRevokeSession,
  } = useSettingsSessionActions();
  const displayTimezone = timeDisplay.displayTimezone;
  const certificateDiagnostics = useCertificateDiagnosticsSettingsModel(canManage);
  const upstreamSecurity = useUpstreamSecuritySettingsModel(canManage);
  const loginDefense = useLoginDefenseSettingsModel(canManage);
  const securityAlert = useSecurityAlertSettingsModel(canManage, displayTimezone);
  const traefikDashboard = useTraefikDashboardSettingsModel(canManage);
  const backupRestore = useBackupRestoreSettings(canManage);
  const cloudflareDns = useCloudflareDnsSettingsSection(displayTimezone);

  return {
    canManage,
    timeDisplay: timeDisplay.card,
    certificateDiagnostics,
    upstreamSecurity,
    loginDefense,
    securityAlert,
    sessionManagement: {
      isLoading: isSessionsLoading,
      sessions: sessionData?.sessions,
      timezone: displayTimezone,
      isLoggingOutAll,
      isRevokingSession,
      onLogoutAll: handleLogoutAllSessions,
      onRevokeSession: handleRevokeSession,
    },
    traefikDashboard,
    cloudflareDns: { canManage, ...cloudflareDns },
    backupRestore: { canManage, ...backupRestore },
  };
}
