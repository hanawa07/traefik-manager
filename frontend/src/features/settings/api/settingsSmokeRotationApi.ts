import apiClient from "@/shared/lib/apiClient";

export type SmokeRotationState = "never" | "running" | "success" | "failure";

export interface SmokeRotationStatus {
  status: SmokeRotationState;
  last_attempt_at: string | null;
  last_success_at: string | null;
  detail: string | null;
}

export const smokeRotationSettingsApi = {
  getSmokeRotationStatus: async (): Promise<SmokeRotationStatus> => {
    const response = await apiClient.get<SmokeRotationStatus>("/settings/smoke-rotation");
    return response.data;
  },
};
