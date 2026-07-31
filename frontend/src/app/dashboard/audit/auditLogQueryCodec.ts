import {
  type AuditBulkNotificationStatus,
  type AuditBulkPeriod,
  type AuditFilterKey,
  type AuditPeriodDays,
  type DeliveryProviderKey,
  type DeliveryStatusKey,
  type ManagerHealthWindowMinutes,
  type ManagerSourceKey,
  type ManagerStatusKey,
  isAuditFilterKey,
  isDeliveryProviderKey,
  isDeliveryStatusKey,
  isManagerSourceKey,
  isManagerStatusKey,
  parseAuditBulkNotificationStatus,
  parseAuditBulkPeriod,
  parseAuditDate,
  parseAuditPeriodDays,
  parseManagerHealthWindowMinutes,
} from "./auditPageHelpers";
import {
  parseAuditPageSize,
  type AuditPageSize,
} from "./auditPageQuery";

interface AuditQueryReader {
  get(key: string): string | null;
}

interface DecodedAuditLogQuery {
  bulkPage: number;
  currentPage: number;
  endDate: string;
  managerHealthWindowMinutes: ManagerHealthWindowMinutes;
  pageSize: AuditPageSize;
  requestedExpandedLogId: string | null;
  searchText: string;
  selectedBulkNotificationStatus: AuditBulkNotificationStatus;
  selectedBulkPeriod: AuditBulkPeriod;
  selectedDeliveryProvider: DeliveryProviderKey;
  selectedDeliveryStatus: DeliveryStatusKey;
  selectedFilter: AuditFilterKey;
  selectedManagerSource: ManagerSourceKey;
  selectedManagerStatus: ManagerStatusKey;
  selectedPeriod: AuditPeriodDays;
  startDate: string;
}

export function decodeAuditLogQuery(searchParams: AuditQueryReader): DecodedAuditLogQuery {
  const requestedFilter = searchParams.get("filter");
  const startDate = parseAuditDate(searchParams.get("start_date"));
  const endDate = parseAuditDate(searchParams.get("end_date"));
  const managerSource = searchParams.get("manager_source");
  const managerStatus = searchParams.get("manager_status");
  const deliveryStatus = searchParams.get("delivery_status");
  const deliveryProvider = searchParams.get("delivery_provider");

  return {
    bulkPage: parseAuditPage(searchParams.get("bulk_page")),
    currentPage: parseAuditPage(searchParams.get("page")),
    endDate,
    managerHealthWindowMinutes: parseManagerHealthWindowMinutes(
      searchParams.get("manager_window"),
    ),
    pageSize: parseAuditPageSize(searchParams.get("page_size")),
    requestedExpandedLogId: searchParams.get("expand"),
    searchText: (searchParams.get("q") || "").slice(0, 100),
    selectedBulkNotificationStatus: parseAuditBulkNotificationStatus(
      searchParams.get("bulk_status"),
    ),
    selectedBulkPeriod: parseAuditBulkPeriod(searchParams.get("bulk_period")),
    selectedDeliveryProvider: isDeliveryProviderKey(deliveryProvider)
      ? deliveryProvider
      : "all",
    selectedDeliveryStatus: isDeliveryStatusKey(deliveryStatus) ? deliveryStatus : "all",
    selectedFilter: isAuditFilterKey(requestedFilter)
      ? requestedFilter
      : isLegacyManagerFilter(requestedFilter)
        ? "manager_health"
        : "all",
    selectedManagerSource: isManagerSourceKey(managerSource)
      ? managerSource
      : requestedFilter === "manager_docker"
        ? "docker"
        : requestedFilter === "manager_watchdog"
          ? "watchdog"
          : "all",
    selectedManagerStatus: isManagerStatusKey(managerStatus)
      ? managerStatus
      : requestedFilter === "manager_unhealthy"
        ? "unhealthy"
        : requestedFilter === "manager_recovered"
          ? "recovered"
          : "all",
    selectedPeriod: startDate || endDate
      ? "all"
      : parseAuditPeriodDays(searchParams.get("period")),
    startDate,
  };
}

export function replaceAuditQueryParam(key: string, value: string, defaultValue: string) {
  replaceAuditQueryParams([[key, value, defaultValue]]);
}

export function replaceAuditQueryParams(
  values: [key: string, value: string, defaultValue: string][],
) {
  const params = new URLSearchParams(window.location.search);
  values.forEach(([key, value, defaultValue]) => {
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
  });
  const query = params.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
}

export function clearAuditQuery() {
  window.history.replaceState(window.history.state, "", window.location.pathname);
}

function parseAuditPage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function isLegacyManagerFilter(value: string | null) {
  return ["manager_docker", "manager_watchdog", "manager_unhealthy", "manager_recovered"].includes(
    value || "",
  );
}
