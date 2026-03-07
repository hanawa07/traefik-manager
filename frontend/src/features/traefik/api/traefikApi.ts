import apiClient from "@/shared/lib/apiClient";

export interface TraefikHealth {
  connected: boolean;
  message: string;
  version: string | null;
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

export const traefikApi = {
  health: async (): Promise<TraefikHealth> => {
    const res = await apiClient.get<TraefikHealth>("/traefik/health");
    return res.data;
  },

  routerStatus: async (): Promise<TraefikRouterStatus> => {
    const res = await apiClient.get<TraefikRouterStatus>("/traefik/routers");
    return res.data;
  },
};
