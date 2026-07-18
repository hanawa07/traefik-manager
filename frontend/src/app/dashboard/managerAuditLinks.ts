const MANAGER_API_AUDIT_BASE =
  "/dashboard/audit?filter=manager_health&manager_source=api&period=90";

export function getManagerApiAuditUrl(searchText?: string) {
  const search = searchText ? `&q=${encodeURIComponent(searchText)}` : "";
  return `${MANAGER_API_AUDIT_BASE}${search}&expand=latest`;
}
