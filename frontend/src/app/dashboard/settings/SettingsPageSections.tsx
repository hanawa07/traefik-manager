import type { ComponentProps } from "react";

import { BackupRestoreSettingsCard } from "@/features/settings/components/BackupRestoreSettingsCard";
import { CertificateDiagnosticsSettingsCard } from "@/features/settings/components/CertificateDiagnosticsSettingsCard";
import { CloudflareDnsSettingsCard } from "@/features/settings/components/CloudflareDnsSettingsCard";
import { LoginDefenseSettingsCard } from "@/features/settings/components/LoginDefenseSettingsCard";
import { SecurityAlertSettingsCard } from "@/features/settings/components/SecurityAlertSettingsCard";
import { SmokeRotationStatusCard } from "@/features/settings/components/SmokeRotationStatusCard";
import { SessionManagementCard } from "@/features/settings/components/SessionManagementCard";
import { TimeDisplaySettingsCard } from "@/features/settings/components/TimeDisplaySettingsCard";
import { TraefikDashboardSettingsCard } from "@/features/settings/components/TraefikDashboardSettingsCard";
import { UpstreamSecuritySettingsCard } from "@/features/settings/components/UpstreamSecuritySettingsCard";
import UserManagementSection from "@/features/users/components/UserManagementSection";

interface SettingsPageSectionsProps {
  canManage: boolean;
  timeDisplay: ComponentProps<typeof TimeDisplaySettingsCard>;
  certificateDiagnostics: ComponentProps<typeof CertificateDiagnosticsSettingsCard>;
  upstreamSecurity: ComponentProps<typeof UpstreamSecuritySettingsCard>;
  loginDefense: ComponentProps<typeof LoginDefenseSettingsCard>;
  securityAlert: ComponentProps<typeof SecurityAlertSettingsCard>;
  smokeRotation: ComponentProps<typeof SmokeRotationStatusCard>;
  sessionManagement: ComponentProps<typeof SessionManagementCard>;
  traefikDashboard: ComponentProps<typeof TraefikDashboardSettingsCard>;
  cloudflareDns: ComponentProps<typeof CloudflareDnsSettingsCard>;
  backupRestore: ComponentProps<typeof BackupRestoreSettingsCard>;
}

export function SettingsPageSections({
  canManage,
  timeDisplay,
  certificateDiagnostics,
  upstreamSecurity,
  loginDefense,
  securityAlert,
  smokeRotation,
  sessionManagement,
  traefikDashboard,
  cloudflareDns,
  backupRestore,
}: SettingsPageSectionsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <TimeDisplaySettingsCard {...timeDisplay} />
      <CertificateDiagnosticsSettingsCard {...certificateDiagnostics} />
      <UpstreamSecuritySettingsCard {...upstreamSecurity} />
      <LoginDefenseSettingsCard {...loginDefense} />
      <SecurityAlertSettingsCard {...securityAlert} />
      <SmokeRotationStatusCard {...smokeRotation} />
      <SessionManagementCard {...sessionManagement} />
      {canManage ? <UserManagementSection className="order-6" /> : null}
      <TraefikDashboardSettingsCard {...traefikDashboard} />
      <CloudflareDnsSettingsCard {...cloudflareDns} />
      <BackupRestoreSettingsCard {...backupRestore} />
    </div>
  );
}
