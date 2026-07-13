import apiClient from "@/shared/lib/apiClient";

export interface DeploymentComponent {
  name: string;
  container_name: string;
  status: string;
  runtime_status: string | null;
  health_status: string | null;
  health_failing_streak: number;
  health_last_checked_at: string | null;
  health_last_exit_code: number | null;
  container_id: string | null;
  image: string | null;
  image_id: string | null;
  image_created: string | null;
  version: string | null;
  revision: string | null;
  build_date: string | null;
  source: string | null;
  oci_labels: Record<string, string>;
}

export interface ExternalWatchdogAlertRun {
  event: "failure" | "recovery";
  requested_at: string;
  run_url: string;
  status: string | null;
  conclusion: string | null;
  checked_at: string | null;
  error: string | null;
}

export interface ManagerHttpErrorBucket {
  started_at: string;
  not_found_count: number;
  server_error_count: number;
}

export interface ManagerHttpErrorPath {
  path: string;
  not_found_count: number;
  server_error_count: number;
  last_seen_at: string;
}

export interface ManagerHttpRequestLogStorage {
  source: "persistent" | "docker" | "unavailable";
  size_bytes: number;
  capacity_bytes: number;
  file_count: number;
  max_file_count: number;
  rotated_file_count: number;
}

export interface ManagerHttpErrorSummary {
  available: boolean;
  message: string;
  window_hours: number;
  path_filter: string | null;
  checked_at: string;
  observed_since: string | null;
  sample_coverage_percent: number;
  not_found_count: number;
  server_error_count: number;
  buckets: ManagerHttpErrorBucket[];
  top_paths: ManagerHttpErrorPath[];
  log_storage: ManagerHttpRequestLogStorage;
}

export interface ManagerHttpErrorMonitorStatus {
  enabled: boolean;
  available: boolean;
  checked_at: string | null;
  last_alert_at: string | null;
  breached: boolean;
  window_minutes: number;
  not_found_count: number;
  not_found_threshold: number;
  server_error_count: number;
  server_error_threshold: number;
  excluded_paths: string[];
}

export interface DeploymentInfo {
  enabled: boolean;
  message: string;
  version: string | null;
  revision: string | null;
  build_date: string | null;
  source: string | null;
  latest_version: string | null;
  latest_release_url: string | null;
  latest_version_checked_at: string | null;
  latest_version_error: string | null;
  update_available: boolean | null;
  external_watchdog_status: "healthy" | "unhealthy" | "unknown";
  external_watchdog_checked_at: string | null;
  external_watchdog_consecutive_failures: number;
  external_watchdog_stale: boolean;
  external_watchdog_stale_after_minutes: number;
  external_watchdog_last_alert_event: "failure" | "recovery" | null;
  external_watchdog_last_alert_success: boolean | null;
  external_watchdog_last_alert_at: string | null;
  external_watchdog_last_alert_run_url: string | null;
  external_watchdog_last_alert_run_status: string | null;
  external_watchdog_last_alert_run_conclusion: string | null;
  external_watchdog_last_alert_run_checked_at: string | null;
  external_watchdog_last_alert_run_error: string | null;
  external_watchdog_alert_runs: ExternalWatchdogAlertRun[];
  http_error_summary: ManagerHttpErrorSummary | null;
  http_error_monitor: ManagerHttpErrorMonitorStatus | null;
  components: DeploymentComponent[];
}

export interface DeploymentInfoRequest {
  refreshLatest?: boolean;
}

export type ManagerHttpErrorWindowHours = 6 | 12 | 24;

export interface ManagerHttpErrorRequest {
  windowHours: ManagerHttpErrorWindowHours;
  path?: string;
}

export const deploymentApi = {
  getInfo: async (request: DeploymentInfoRequest = {}): Promise<DeploymentInfo> => {
    const res = await apiClient.get<DeploymentInfo>("/docker/deployment", {
      params: request.refreshLatest ? { refresh_latest: true } : undefined,
    });
    return res.data;
  },
  getHttpErrors: async (request: ManagerHttpErrorRequest): Promise<ManagerHttpErrorSummary> => {
    const res = await apiClient.get<ManagerHttpErrorSummary>("/docker/http-errors", {
      params: {
        window_hours: request.windowHours,
        path: request.path || undefined,
      },
    });
    return res.data;
  },
};
