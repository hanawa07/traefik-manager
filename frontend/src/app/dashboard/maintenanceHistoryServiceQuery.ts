const MAINTENANCE_HISTORY_SERVICE_KEY = "maintenance_history_service";
const SERVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readMaintenanceHistoryServiceId() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(
    MAINTENANCE_HISTORY_SERVICE_KEY,
  );
  return value && SERVICE_ID_PATTERN.test(value) ? value : null;
}

export function replaceMaintenanceHistoryServiceId(serviceId: string | null) {
  const url = new URL(window.location.href);
  if (serviceId) url.searchParams.set(MAINTENANCE_HISTORY_SERVICE_KEY, serviceId);
  else url.searchParams.delete(MAINTENANCE_HISTORY_SERVICE_KEY);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}
