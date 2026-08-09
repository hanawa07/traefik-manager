import type { ComponentProps, ReactNode } from "react";

import { BackupRestoreSettingsCard } from "@/features/settings/components/BackupRestoreSettingsCard";
import { AuditRetentionSettingsCard } from "@/features/settings/components/AuditRetentionSettingsCard";
import { CertificateDiagnosticsSettingsCard } from "@/features/settings/components/CertificateDiagnosticsSettingsCard";
import { CloudflareDnsSettingsCard } from "@/features/settings/components/CloudflareDnsSettingsCard";
import { DeploymentBottleneckSettingsCard } from "@/features/settings/components/DeploymentBottleneckSettingsCard";
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
  auditRetention: ComponentProps<typeof AuditRetentionSettingsCard>;
  certificateDiagnostics: ComponentProps<typeof CertificateDiagnosticsSettingsCard>;
  deploymentBottleneck: ComponentProps<typeof DeploymentBottleneckSettingsCard>;
  upstreamSecurity: ComponentProps<typeof UpstreamSecuritySettingsCard>;
  loginDefense: ComponentProps<typeof LoginDefenseSettingsCard>;
  securityAlert: ComponentProps<typeof SecurityAlertSettingsCard>;
  smokeRotation: ComponentProps<typeof SmokeRotationStatusCard>;
  sessionManagement: ComponentProps<typeof SessionManagementCard>;
  traefikDashboard: ComponentProps<typeof TraefikDashboardSettingsCard>;
  cloudflareDns: ComponentProps<typeof CloudflareDnsSettingsCard>;
  backupRestore: ComponentProps<typeof BackupRestoreSettingsCard>;
}

function SettingsSectionGroup({
  children,
  sectionKey,
  title,
}: {
  children: ReactNode;
  sectionKey: "basic" | "security" | "operations" | "data";
  title: string;
}) {
  const headingId = `settings-${sectionKey}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4"
      data-testid={`settings-section-${sectionKey}`}
    >
      <h2
        id={headingId}
        className="border-b border-gray-200 pb-2 text-sm font-semibold text-gray-700 dark:border-slate-700 dark:text-slate-200"
      >
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2" data-testid="settings-section-grid">
        {children}
      </div>
    </section>
  );
}

export function SettingsPageSections({
  canManage,
  timeDisplay,
  auditRetention,
  certificateDiagnostics,
  deploymentBottleneck,
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
    <div className="space-y-8" data-testid="settings-sections">
      <SettingsSectionGroup sectionKey="basic" title="기본">
        <TimeDisplaySettingsCard {...timeDisplay} />
        <TraefikDashboardSettingsCard {...traefikDashboard} />
      </SettingsSectionGroup>

      <SettingsSectionGroup sectionKey="security" title="보안">
        <LoginDefenseSettingsCard {...loginDefense} />
        <UpstreamSecuritySettingsCard {...upstreamSecurity} />
        <SessionManagementCard {...sessionManagement} />
        {canManage ? <UserManagementSection /> : null}
        <SecurityAlertSettingsCard {...securityAlert} />
      </SettingsSectionGroup>

      <SettingsSectionGroup sectionKey="operations" title="운영">
        <CertificateDiagnosticsSettingsCard {...certificateDiagnostics} />
        <DeploymentBottleneckSettingsCard {...deploymentBottleneck} />
        <SmokeRotationStatusCard {...smokeRotation} />
        <CloudflareDnsSettingsCard {...cloudflareDns} />
      </SettingsSectionGroup>

      <SettingsSectionGroup sectionKey="data" title="데이터">
        <AuditRetentionSettingsCard {...auditRetention} />
        <BackupRestoreSettingsCard {...backupRestore} />
      </SettingsSectionGroup>
    </div>
  );
}
