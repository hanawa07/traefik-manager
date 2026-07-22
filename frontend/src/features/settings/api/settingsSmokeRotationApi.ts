import apiClient from "@/shared/lib/apiClient";
import type { SettingsActionTestResult } from "./settingsSharedTypes";

export type SmokeRotationState = "never" | "running" | "success" | "failure";
export type SmokeMonitoringFrequency = "daily" | "weekly";
export type SmokeFailureRateWindowDays = 7 | 30;
export type SmokeHistoryDays = 7 | 30;
export type SmokeHistoryStatus = "all" | "success" | "failure";

export interface SmokeFailureMetadata {
  captured_at: string;
  check_name: string;
  screen_path: string | null;
  page_title: string | null;
}

export interface SmokeMonitoringSettingsInput {
  monitoring_enabled: boolean;
  monitoring_frequency: SmokeMonitoringFrequency;
  monitoring_failure_rate_threshold_percent: number;
  monitoring_failure_rate_min_runs: number;
  monitoring_failure_rate_window_days: SmokeFailureRateWindowDays;
  monitoring_github_rate_limit_alert_enabled: boolean;
  monitoring_github_primary_limit_alert_threshold: number;
  monitoring_github_secondary_limit_alert_threshold: number;
  monitoring_github_rate_limit_alert_window_hours: number;
}

export interface SmokeMonitoringRecentRun {
  run_id: number;
  status: "success" | "failure" | "skipped";
  completed_at: string;
  run_url: string;
  run_number: number | null;
  commit_sha: string | null;
  summary: string | null;
  notification_suppressed: boolean;
  artifact_url: string | null;
  artifact_expires_at: string | null;
  failure_metadata: SmokeFailureMetadata | null;
}

export interface SmokeRotationStatus {
  monitoring_enabled: boolean;
  monitoring_frequency: SmokeMonitoringFrequency;
  monitoring_failure_rate_threshold_percent: number;
  monitoring_failure_rate_min_runs: number;
  monitoring_failure_rate_window_days: SmokeFailureRateWindowDays;
  monitoring_github_rate_limit_alert_enabled: boolean;
  monitoring_github_primary_limit_alert_threshold: number;
  monitoring_github_secondary_limit_alert_threshold: number;
  monitoring_github_rate_limit_alert_window_hours: number;
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
  monitoring_history_days: SmokeHistoryDays;
  monitoring_history_page: number;
  monitoring_history_per_page: number;
  monitoring_history_total: number;
  monitoring_history_total_pages: number;
  monitoring_history_search: string;
  monitoring_history_status: SmokeHistoryStatus;
  monitoring_failure_metadata_count: number;
  monitoring_failure_metadata_limit: number;
  monitoring_github_rate_limit_remaining: number | null;
  monitoring_github_rate_limit_limit: number | null;
  monitoring_github_rate_limit_reset_at: string | null;
  monitoring_github_secondary_limit_retry_at: string | null;
  monitoring_github_refresh_reserve: number;
  monitoring_github_history_cache_items: number | null;
  monitoring_github_history_cache_capacity: number | null;
  monitoring_github_history_cache_hits: number | null;
  monitoring_github_history_cache_misses: number | null;
  monitoring_github_last_request_count: number | null;
  monitoring_github_last_workflow_request_count: number | null;
  monitoring_github_last_job_request_count: number | null;
  monitoring_github_last_artifact_request_count: number | null;
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
    const response = await apiClient.get<SmokeRotationStatus>(
      "/settings/smoke-rotation?summary=true&history=true&history_days=30",
    );
    return response.data;
  },
  getSmokeRunHistory: async (
    days: SmokeHistoryDays,
    page: number,
    search: string,
    status: SmokeHistoryStatus,
  ): Promise<SmokeRotationStatus> => {
    const response = await apiClient.get<SmokeRotationStatus>("/settings/smoke-rotation", {
      params: {
        history: true,
        history_days: days,
        history_page: page,
        history_search: search || undefined,
        history_status: status,
        summary: true,
      },
    });
    return response.data;
  },
  testSmokeAdminStaleAlert: async (): Promise<SettingsActionTestResult> => {
    const response = await apiClient.post<SettingsActionTestResult>(
      "/settings/smoke-admin-stale/test",
    );
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
