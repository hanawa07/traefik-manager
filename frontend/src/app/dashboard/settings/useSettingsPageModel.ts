import { useState } from "react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { useBackupRestoreSettings } from "@/features/settings/hooks/useBackupRestoreSettings";
import { useCloudflareDnsSettingsSection } from "@/features/settings/hooks/useCloudflareDnsSettingsSection";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
import { useCertificateDiagnosticsSettingsModel } from "./useCertificateDiagnosticsSettingsModel";
import { useDeploymentBottleneckSettingsModel } from "./useDeploymentBottleneckSettingsModel";
import { useAuditRetentionSettingsModel } from "./useAuditRetentionSettingsModel";
import { useLoginDefenseSettingsModel } from "./useLoginDefenseSettingsModel";
import { useSecurityAlertSettingsModel } from "./useSecurityAlertSettingsModel";
import { useSmokeMonitoringSettingsModel } from "./useSmokeMonitoringSettingsModel";
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
  const auditRetention = useAuditRetentionSettingsModel(canManage, displayTimezone, setToastNotice);
  const certificateDiagnostics = useCertificateDiagnosticsSettingsModel(canManage, setToastNotice);
  const deploymentBottleneck = useDeploymentBottleneckSettingsModel(canManage, setToastNotice);
  const upstreamSecurity = useUpstreamSecuritySettingsModel(canManage, setToastNotice);
  const loginDefense = useLoginDefenseSettingsModel(canManage, setToastNotice);
  const securityAlert = useSecurityAlertSettingsModel(canManage, displayTimezone, setToastNotice);
  const smokeRotation = useSmokeMonitoringSettingsModel(
    canManage,
    displayTimezone,
    setToastNotice,
  );
  const traefikDashboard = useTraefikDashboardSettingsModel(canManage, setToastNotice);
  const backupRestore = useBackupRestoreSettings(canManage, setToastNotice);
  const cloudflareDns = useCloudflareDnsSettingsSection(displayTimezone, setToastNotice);

  return {
    canManage,
    toastNotice,
    onDismissToast: () => setToastNotice(null),
    timeDisplay: timeDisplay.card,
    auditRetention,
    certificateDiagnostics,
    deploymentBottleneck,
    upstreamSecurity,
    loginDefense,
    securityAlert,
    smokeRotation,
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
