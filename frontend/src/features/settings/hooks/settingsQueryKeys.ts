export const settingsQueryKeys = {
  auditLogs: ["audit-logs"] as const,
  certificateDiagnostics: ["settings", "certificate-diagnostics"] as const,
  cloudflare: ["settings", "cloudflare"] as const,
  loginDefense: ["settings", "login-defense"] as const,
  redirectHosts: ["redirect-hosts"] as const,
  securityAlerts: ["settings", "security-alerts"] as const,
  services: ["services"] as const,
  testHistory: ["settings", "test-history"] as const,
  timeDisplay: ["settings", "time-display"] as const,
  traefikDashboard: ["settings", "traefik-dashboard"] as const,
  traefikHealth: ["traefik-health"] as const,
  traefikRouterStatus: ["traefik-router-status"] as const,
  upstreamSecurity: ["settings", "upstream-security"] as const,
};

export const backupImportInvalidationKeys = [
  settingsQueryKeys.services,
  settingsQueryKeys.redirectHosts,
  settingsQueryKeys.traefikHealth,
  settingsQueryKeys.traefikRouterStatus,
] as const;

export const settingsRollbackInvalidationKeys = [
  settingsQueryKeys.auditLogs,
  settingsQueryKeys.timeDisplay,
  settingsQueryKeys.certificateDiagnostics,
  settingsQueryKeys.traefikDashboard,
  settingsQueryKeys.upstreamSecurity,
  settingsQueryKeys.loginDefense,
  settingsQueryKeys.securityAlerts,
  settingsQueryKeys.cloudflare,
] as const;
