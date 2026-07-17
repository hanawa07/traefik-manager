import apiClient from "@/shared/lib/apiClient";

export interface DeploymentBottleneckSettings {
  threshold_ms: number;
  consecutive_count: number;
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
};
