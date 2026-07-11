import apiClient from "@/shared/lib/apiClient";

export type SmokeRotationState = "never" | "running" | "success" | "failure";
export type SmokeMonitoringFrequency = "daily" | "weekly";

export interface SmokeMonitoringSettingsInput {
  monitoring_enabled: boolean;
  monitoring_frequency: SmokeMonitoringFrequency;
}

export interface SmokeRotationStatus {
  monitoring_enabled: boolean;
  monitoring_frequency: SmokeMonitoringFrequency;
  monitoring_schedule_time: string;
  monitoring_schedule_timezone: string;
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
  updateSmokeMonitoringSettings: async (
    input: SmokeMonitoringSettingsInput,
  ): Promise<SmokeRotationStatus> => {
    const response = await apiClient.put<SmokeRotationStatus>("/settings/smoke-rotation", input);
    return response.data;
  },
};
