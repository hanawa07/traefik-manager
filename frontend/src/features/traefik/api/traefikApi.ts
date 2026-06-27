import apiClient from "@/shared/lib/apiClient";

export interface TraefikHealth {
  connected: boolean;
  message: string;
  version: string | null;
  latest_version: string | null;
  update_available: boolean | null;
  latest_version_checked_at: string | null;
  latest_version_error: string | null;
}

export interface TraefikRouterItem {
  name: string;
  status: string;
  rule: string;
}

export interface TraefikDomainStatus {
  active: boolean;
  routers: TraefikRouterItem[];
}

export interface TraefikRouterStatus {
  connected: boolean;
  message: string;
  domains: Record<string, TraefikDomainStatus>;
}

export interface TraefikMiddlewareItem {
  name: string;
  provider: string | null;
  status: string;
  type: string;
  used_by: string[];
  config: Record<string, unknown>;
}

export interface TraefikMiddlewareList {
  connected: boolean;
  message: string;
  middlewares: TraefikMiddlewareItem[];
}

export const traefikApi = {
  health: async (): Promise<TraefikHealth> => {
    const res = await apiClient.get<TraefikHealth>("/traefik/health");
    return res.data;
  },

  routerStatus: async (): Promise<TraefikRouterStatus> => {
    const res = await apiClient.get<TraefikRouterStatus>("/traefik/routers");
    return res.data;
  },

  middlewares: async (): Promise<TraefikMiddlewareList> => {
    const res = await apiClient.get<TraefikMiddlewareList>("/traefik/middlewares");
    return res.data;
  },
};
