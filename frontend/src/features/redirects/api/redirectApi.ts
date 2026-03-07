import apiClient from "@/shared/lib/apiClient";

export interface RedirectHost {
  id: string;
  domain: string;
  target_url: string;
  permanent: boolean;
  tls_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RedirectHostCreate {
  domain: string;
  target_url: string;
  permanent: boolean;
  tls_enabled: boolean;
}

export interface RedirectHostUpdate {
  domain?: string;
  target_url?: string;
  permanent?: boolean;
  tls_enabled?: boolean;
}

export const redirectApi = {
  list: async (): Promise<RedirectHost[]> => {
    const res = await apiClient.get<RedirectHost[]>("/redirects/");
    return res.data;
  },

  create: async (data: RedirectHostCreate): Promise<RedirectHost> => {
    const res = await apiClient.post<RedirectHost>("/redirects/", data);
    return res.data;
  },

  update: async (id: string, data: RedirectHostUpdate): Promise<RedirectHost> => {
    const res = await apiClient.patch<RedirectHost>(`/redirects/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/redirects/${id}`);
  },
};
