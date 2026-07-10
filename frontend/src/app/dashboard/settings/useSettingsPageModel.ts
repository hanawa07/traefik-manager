import { useState } from "react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useBackupRestoreSettings } from "@/features/settings/hooks/useBackupRestoreSettings";
import { useCloudflareDnsSettingsSection } from "@/features/settings/hooks/useCloudflareDnsSettingsSection";
import { useSmokeRotationStatus } from "@/features/settings/hooks/useSettings";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
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
  const [toastNotice, setToastNotice] = useState<ToastNoticeValue | null>(null);
  const timeDisplay = useTimeDisplaySettingsModel(canManage, setToastNotice);
  const {
    sessionData,
    isSessionsLoading,
    isLoggingOutAll,
    isRevokingSession,
    handleLogoutAllSessions,
    handleRevokeSession,
  } = useSettingsSessionActions();
  const displayTimezone = timeDisplay.displayTimezone;
  const certificateDiagnostics = useCertificateDiagnosticsSettingsModel(canManage, setToastNotice);
  const upstreamSecurity = useUpstreamSecuritySettingsModel(canManage, setToastNotice);
  const loginDefense = useLoginDefenseSettingsModel(canManage, setToastNotice);
  const securityAlert = useSecurityAlertSettingsModel(canManage, displayTimezone, setToastNotice);
  const smokeRotation = useSmokeRotationStatus();
  const traefikDashboard = useTraefikDashboardSettingsModel(canManage, setToastNotice);
  const backupRestore = useBackupRestoreSettings(canManage, setToastNotice);
  const cloudflareDns = useCloudflareDnsSettingsSection(displayTimezone, setToastNotice);

  return {
    canManage,
    toastNotice,
    onDismissToast: () => setToastNotice(null),
    timeDisplay: timeDisplay.card,
    certificateDiagnostics,
    upstreamSecurity,
    loginDefense,
    securityAlert,
    smokeRotation: {
      isLoading: smokeRotation.isLoading,
      isError: smokeRotation.isError,
      status: smokeRotation.data,
      timezone: displayTimezone,
    },
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
