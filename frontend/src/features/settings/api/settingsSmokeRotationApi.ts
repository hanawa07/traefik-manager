import apiClient from "@/shared/lib/apiClient";

export type SmokeRotationState = "never" | "running" | "success" | "failure";
export type SmokeMonitoringFrequency = "daily" | "weekly";

export interface SmokeMonitoringSettingsInput {
  monitoring_enabled: boolean;
  monitoring_frequency: SmokeMonitoringFrequency;
}

export interface SmokeMonitoringRecentRun {
  status: "success" | "failure" | "skipped";
  completed_at: string;
  run_url: string;
  run_number: number | null;
  commit_sha: string | null;
  summary: string | null;
  notification_suppressed: boolean;
  artifact_url: string | null;
  artifact_expires_at: string | null;
}

export interface SmokeRotationStatus {
  monitoring_enabled: boolean;
  monitoring_frequency: SmokeMonitoringFrequency;
  monitoring_schedule_time: string;
  monitoring_schedule_timezone: string;
  monitoring_last_success_at: string | null;
  monitoring_last_run_url: string | null;
  monitoring_admin_last_success_at: string | null;
  monitoring_admin_last_run_url: string | null;
  monitoring_admin_is_stale: boolean;
  monitoring_admin_stale_after_days: number;
  monitoring_workflow_url: string;
  monitoring_recent_runs: SmokeMonitoringRecentRun[];
  monitoring_latest_failure: SmokeMonitoringRecentRun | null;
  monitoring_history_checked_at: string | null;
  monitoring_history_error: string | null;
  status: SmokeRotationState;
  last_attempt_at: string | null;
  last_success_at: string | null;
  detail: string | null;
  is_stale: boolean;
  stale_after_days: number;
  recent_log_lines: string[];
  log_updated_at: string | null;
}

export const smokeRotationSettingsApi = {
  getSmokeRotationStatus: async (): Promise<SmokeRotationStatus> => {
    const response = await apiClient.get<SmokeRotationStatus>("/settings/smoke-rotation");
    return response.data;
  },
  getSmokeRotationSummary: async (): Promise<SmokeRotationStatus> => {
    const response = await apiClient.get<SmokeRotationStatus>("/settings/smoke-rotation?summary=true");
    return response.data;
  },
  refreshSmokeMonitoringHistory: async (): Promise<SmokeRotationStatus> => {
    const response = await apiClient.get<SmokeRotationStatus>(
      "/settings/smoke-rotation?refresh_monitoring_history=true",
    );
    return response.data;
  },
  updateSmokeMonitoringSettings: async (
    input: SmokeMonitoringSettingsInput,
  ): Promise<SmokeRotationStatus> => {
    const response = await apiClient.put<SmokeRotationStatus>("/settings/smoke-rotation", input);
    return response.data;
  },
};
