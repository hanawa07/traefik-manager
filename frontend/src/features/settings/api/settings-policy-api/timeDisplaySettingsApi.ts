import apiClient from "@/shared/lib/apiClient";

export interface TimeDisplaySettingsStatus {
  display_timezone: string;
  display_timezone_name: string;
  display_timezone_label: string;
  storage_timezone: string;
  server_timezone_name: string;
  server_timezone_label: string;
  server_timezone_offset: string;
  server_time_iso: string;
}

export interface TimeDisplaySettingsInput {
  display_timezone: string;
}

export const timeDisplaySettingsApi = {
  getTimeDisplaySettings: async (): Promise<TimeDisplaySettingsStatus> => {
    const res = await apiClient.get<TimeDisplaySettingsStatus>("/settings/time-display");
    return res.data;
  },

  updateTimeDisplaySettings: async (
    payload: TimeDisplaySettingsInput,
  ): Promise<TimeDisplaySettingsStatus> => {
    const res = await apiClient.put<TimeDisplaySettingsStatus>("/settings/time-display", payload);
    return res.data;
  },
};
