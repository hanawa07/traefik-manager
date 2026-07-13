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
  components: DeploymentComponent[];
}

export interface DeploymentInfoRequest {
  refreshLatest?: boolean;
}

export const deploymentApi = {
  getInfo: async (request: DeploymentInfoRequest = {}): Promise<DeploymentInfo> => {
    const res = await apiClient.get<DeploymentInfo>("/docker/deployment", {
      params: request.refreshLatest ? { refresh_latest: true } : undefined,
    });
    return res.data;
  },
};
