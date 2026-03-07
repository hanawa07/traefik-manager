import apiClient from "@/shared/lib/apiClient";

export interface Service {
  id: string;
  name: string;
  domain: string;
  upstream_host: string;
  upstream_port: number;
  tls_enabled: boolean;
  auth_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceCreate {
  name: string;
  domain: string;
  upstream_host: string;
  upstream_port: number;
  tls_enabled: boolean;
  auth_enabled: boolean;
}

export interface ServiceUpdate {
  name?: string;
  upstream_host?: string;
  upstream_port?: number;
  tls_enabled?: boolean;
  auth_enabled?: boolean;
}

export const serviceApi = {
  list: async (): Promise<Service[]> => {
    const res = await apiClient.get<Service[]>("/services/");
    return res.data;
  },

  get: async (id: string): Promise<Service> => {
    const res = await apiClient.get<Service>(`/services/${id}`);
    return res.data;
  },

  create: async (data: ServiceCreate): Promise<Service> => {
    const res = await apiClient.post<Service>("/services/", data);
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
