import apiClient from "@/shared/lib/apiClient";

export type MiddlewareTemplateType = "ipAllowList" | "rateLimit" | "basicAuth" | "headers";

export interface MiddlewareTemplate {
  id: string;
  name: string;
  type: MiddlewareTemplateType;
  config: Record<string, unknown>;
  shared_name: string;
  created_at: string;
  updated_at: string;
}

export interface MiddlewareTemplateCreate {
  name: string;
  type: MiddlewareTemplateType;
  config: Record<string, unknown>;
}

export interface MiddlewareTemplateUpdate {
  name?: string;
  type?: MiddlewareTemplateType;
  config?: Record<string, unknown>;
}

export const middlewareApi = {
  list: async (): Promise<MiddlewareTemplate[]> => {
    const res = await apiClient.get<MiddlewareTemplate[]>("/middlewares/");
    return res.data;
  },

  get: async (id: string): Promise<MiddlewareTemplate> => {
    const res = await apiClient.get<MiddlewareTemplate>(`/middlewares/${id}`);
    return res.data;
  },

  create: async (data: MiddlewareTemplateCreate): Promise<MiddlewareTemplate> => {
    const res = await apiClient.post<MiddlewareTemplate>("/middlewares/", data);
    return res.data;
  },

  update: async (id: string, data: MiddlewareTemplateUpdate): Promise<MiddlewareTemplate> => {
    const res = await apiClient.put<MiddlewareTemplate>(`/middlewares/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/middlewares/${id}`);
  },
};
