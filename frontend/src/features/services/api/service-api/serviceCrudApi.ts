import apiClient from "@/shared/lib/apiClient";

import type { Service, ServiceCreate, ServiceUpdate } from "./serviceTypes";

export const serviceCrudApi = {
  list: async (): Promise<Service[]> => {
    const res = await apiClient.get<Service[]>("/services");
    return res.data;
  },

  get: async (id: string): Promise<Service> => {
    const res = await apiClient.get<Service>(`/services/${id}`);
    return res.data;
  },

  create: async (data: ServiceCreate): Promise<Service> => {
    const res = await apiClient.post<Service>("/services", data);
    return res.data;
  },

  update: async (id: string, data: ServiceUpdate): Promise<Service> => {
    const res = await apiClient.patch<Service>(`/services/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/services/${id}`);
  },
};
