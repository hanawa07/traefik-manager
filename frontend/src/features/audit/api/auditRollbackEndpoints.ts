export type AuditRollbackResourceType = "settings" | "service" | "redirect" | "middleware" | "user";

const AUDIT_ROLLBACK_ENDPOINTS: Record<AuditRollbackResourceType, string> = {
  settings: "/settings/rollback",
  service: "/services/rollback",
  redirect: "/redirects/rollback",
  middleware: "/middlewares/rollback",
  user: "/users/rollback",
};

export function getAuditRollbackEndpoint(
  resourceType: AuditRollbackResourceType,
  auditLogId: string,
) {
  return `${AUDIT_ROLLBACK_ENDPOINTS[resourceType]}/${auditLogId}`;
}
