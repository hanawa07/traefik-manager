import { cloudflareSettingsApi } from "./settingsCloudflareApi";
import { auditRetentionSettingsApi } from "./settingsAuditRetentionApi";
import { policySettingsApi } from "./settingsPolicyApi";
import { securityAlertSettingsApi } from "./settingsSecurityAlertApi";
import { settingsBackupApi } from "./settingsBackupApi";
import { settingsHistoryApi } from "./settingsHistoryApi";
import { smokeRotationSettingsApi } from "./settingsSmokeRotationApi";

export type {
  AuditArchiveItem,
  AuditArchiveListStatus,
  AuditArchiveRestoreResult,
  AuditRetentionSettingsInput,
  AuditRetentionSettingsStatus,
} from "./settingsAuditRetentionApi";
export type {
  BackupImportResult,
  BackupPayload,
  BackupPreviewGroup,
  BackupPreviewItem,
  BackupPreviewResult,
  BackupRedirectHostItem,
  BackupServiceItem,
  BackupValidateResult,
} from "./settingsBackupTypes";
export type {
  CloudflareDriftCheckResult,
  CloudflareDriftRecord,
  CloudflareDriftZone,
  CloudflareExcludedService,
  CloudflareSettingsInput,
  CloudflareSettingsStatus,
  CloudflareZoneInput,
  CloudflareZoneStatus,
} from "./settingsCloudflareApi";
export type {
  CertificateDiagnosticsSettingsInput,
  CertificateDiagnosticsSettingsStatus,
  LoginDefenseSettingsInput,
  LoginDefenseSettingsStatus,
  TimeDisplaySettingsInput,
  TimeDisplaySettingsStatus,
  TraefikDashboardSettingsInput,
  TraefikDashboardSettingsStatus,
  UpstreamSecurityPreset,
  UpstreamSecuritySettingsInput,
  UpstreamSecuritySettingsStatus,
} from "./settingsPolicyApi";
export type {
  ChangeAlertEventRoutes,
  ChangeAlertRouteEvent,
  SecurityAlertEventRoutes,
  SecurityAlertRouteEvent,
  SecurityAlertRouteTarget,
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
} from "./settingsSecurityAlertApi";
export type {
  SettingsActionTestResult,
  SettingsRollbackActionResult,
  SettingsTestHistoryItem,
  SettingsTestHistoryStatus,
} from "./settingsSharedTypes";
export type {
  SmokeMonitoringFrequency,
  SmokeMonitoringSettingsInput,
  SmokeRotationState,
  SmokeRotationStatus,
} from "./settingsSmokeRotationApi";

export const settingsApi = {
  ...auditRetentionSettingsApi,
  ...cloudflareSettingsApi,
  ...policySettingsApi,
  ...securityAlertSettingsApi,
  ...settingsHistoryApi,
  ...settingsBackupApi,
  ...smokeRotationSettingsApi,
};
