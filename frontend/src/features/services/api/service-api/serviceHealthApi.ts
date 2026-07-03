import apiClient from "@/shared/lib/apiClient";

import type { ServiceGatewayDiagnosis, ServiceGatewayNetworkConnectResult, UpstreamHealth } from "./serviceTypes";

export const serviceHealthApi = {
  getServiceHealth: async (id: string): Promise<UpstreamHealth> => {
    const res = await apiClient.get<UpstreamHealth>(`/services/${id}/health`);
    return res.data;
  },

  getAllServicesHealth: async (): Promise<Record<string, UpstreamHealth>> => {
    const res = await apiClient.get<Record<string, UpstreamHealth>>("/services/health/all");
    return res.data;
  },

  diagnoseGateway: async (id: string): Promise<ServiceGatewayDiagnosis> => {
    const res = await apiClient.get<ServiceGatewayDiagnosis>(`/services/${id}/diagnostics/gateway`);
    return res.data;
  },

  connectGatewayNetwork: async (id: string): Promise<ServiceGatewayNetworkConnectResult> => {
    const res = await apiClient.post<ServiceGatewayNetworkConnectResult>(
      `/services/${id}/diagnostics/gateway/network/connect`
    );
    return res.data;
  },
};
