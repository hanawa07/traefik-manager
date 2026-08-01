import apiClient from "@/shared/lib/apiClient";

import type {
  DeploymentInfo,
  DeploymentInfoRequest,
  ManagerHttpErrorRequest,
  ManagerHttpErrorSummary,
} from "./deploymentTypes";

export type * from "./deploymentTypes";

export const MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_LIMIT = 100;
export const MANAGER_DEPLOYMENT_BOTTLENECK_EVENT_WARNING_COUNT = 80;

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
