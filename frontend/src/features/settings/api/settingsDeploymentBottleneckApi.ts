import apiClient from "@/shared/lib/apiClient";

export interface DeploymentBottleneckSettings {
  threshold_ms: number;
  consecutive_count: number;
  event_retention_days: number;
}

export interface DeploymentBottleneckCleanupResult {
  retention_days: number;
  deleted_count: number;
  retained_event_count: number;
  oldest_event_at: string | null;
  newest_event_at: string | null;
}

export const deploymentBottleneckSettingsApi = {
  getDeploymentBottleneckSettings: async (): Promise<DeploymentBottleneckSettings> => {
    const response = await apiClient.get<DeploymentBottleneckSettings>(
      "/settings/deployment-bottleneck-alert",
    );
    return response.data;
  },

  updateDeploymentBottleneckSettings: async (
    payload: DeploymentBottleneckSettings,
  ): Promise<DeploymentBottleneckSettings> => {
    const response = await apiClient.put<DeploymentBottleneckSettings>(
      "/settings/deployment-bottleneck-alert",
      payload,
    );
    return response.data;
  },

  cleanupDeploymentBottleneckEvents: async (): Promise<DeploymentBottleneckCleanupResult> => {
    const response = await apiClient.post<DeploymentBottleneckCleanupResult>(
      "/settings/deployment-bottleneck-alert/cleanup",
    );
    return response.data;
  },
};
