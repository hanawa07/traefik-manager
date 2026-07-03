import apiClient from "@/shared/lib/apiClient";

import type { ServiceGatewayDiagnosis, UpstreamHealth } from "./serviceTypes";

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
};
