import apiClient from "@/shared/lib/apiClient";

export interface Service {
  id: string;
  name: string;
  domain: string;
  upstream_host: string;
  upstream_port: number;
  tls_enabled: boolean;
  https_redirect_enabled: boolean;
  auth_enabled: boolean;
  allowed_ips: string[];
  rate_limit_enabled: boolean;
  rate_limit_average: number | null;
  rate_limit_burst: number | null;
  custom_headers: Record<string, string>;
  basic_auth_enabled: boolean;
  basic_auth_user_count: number;
  middleware_template_ids: string[];
  authentik_group_id: string | null;
  authentik_group_name: string | null;
  cloudflare_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BasicAuthCredential {
  username: string;
  password: string;
}

export interface ServiceCreate {
  name: string;
  domain: string;
  upstream_host: string;
  upstream_port: number;
  tls_enabled: boolean;
  https_redirect_enabled: boolean;
  auth_enabled: boolean;
  basic_auth_enabled: boolean;
  rate_limit_enabled?: boolean;
  allowed_ips: string[];
  rate_limit_average: number | null;
  rate_limit_burst: number | null;
  custom_headers: Record<string, string>;
  basic_auth_credentials?: BasicAuthCredential[];
  middleware_template_ids: string[];
  authentik_group_id?: string | null;
}

export interface ServiceUpdate {
  name?: string;
  upstream_host?: string;
  upstream_port?: number;
  tls_enabled?: boolean;
  https_redirect_enabled?: boolean;
  auth_enabled?: boolean;
  basic_auth_enabled?: boolean;
  rate_limit_enabled?: boolean;
  rate_limit_average?: number | null;
  rate_limit_burst?: number | null;
  custom_headers?: Record<string, string>;
  allowed_ips?: string[];
  basic_auth_credentials?: BasicAuthCredential[];
  middleware_template_ids?: string[];
  authentik_group_id?: string | null;
}

export interface AuthentikGroup {
  id: string;
  name: string;
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

  listAuthentikGroups: async (): Promise<AuthentikGroup[]> => {
    const res = await apiClient.get<AuthentikGroup[]>("/services/authentik/groups");
    return res.data;
  },
};
