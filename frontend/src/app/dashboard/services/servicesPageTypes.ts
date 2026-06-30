export type SortKey = "name" | "domain" | "auth" | "router" | "health" | "created_at";
export type SortDir = "asc" | "desc";
export type HealthFilter =
  | "all"
  | "up"
  | "down"
  | "unknown"
  | "dns"
  | "connection_refused"
  | "timeout"
  | "unexpected_status"
  | "other_error";

export type HealthHistoryEntry = {
  last_up_at?: string;
  last_down_at?: string;
  last_unknown_at?: string;
};
