import apiClient from "@/shared/lib/apiClient";

export interface TraefikHealth {
  connected: boolean;
  message: string;
  version: string | null;
  latest_version: string | null;
  latest_release_url: string | null;
  update_available: boolean | null;
  latest_version_checked_at: string | null;
  latest_version_error: string | null;
}

export interface TraefikHealthRequest {
  refreshLatest?: boolean;
}

export interface TraefikDeploymentCheck {
  key: string;
  label: string;
  status: "ok" | "warning" | "fail";
  message: string;
}

export interface TraefikDeploymentCommand {
  label: string;
  description: string;
  command: string;
}

export interface TraefikDeploymentStatus {
  enabled: boolean;
  message: string;
  container_name: string | null;
  current_image: string | null;
  target_image: string | null;
  current_version: string | null;
  target_version: string | null;
  update_available: boolean | null;
  compose_project: string | null;
  compose_service: string | null;
  compose_working_dir: string | null;
  compose_config_files: string[];
  can_apply: boolean;
  apply_blocked_reason: string | null;
  checks: TraefikDeploymentCheck[];
  commands: TraefikDeploymentCommand[];
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
  health: async (request: TraefikHealthRequest = {}): Promise<TraefikHealth> => {
    const res = await apiClient.get<TraefikHealth>("/traefik/health", {
      params: request.refreshLatest ? { refresh_latest: true } : undefined,
    });
    return res.data;
  },

  routerStatus: async (): Promise<TraefikRouterStatus> => {
    const res = await apiClient.get<TraefikRouterStatus>("/traefik/routers");
    return res.data;
  },

  deployment: async (request: TraefikHealthRequest = {}): Promise<TraefikDeploymentStatus> => {
    const res = await apiClient.get<TraefikDeploymentStatus>("/traefik/deployment", {
      params: request.refreshLatest ? { refresh_latest: true } : undefined,
    });
    return res.data;
  },

  middlewares: async (): Promise<TraefikMiddlewareList> => {
    const res = await apiClient.get<TraefikMiddlewareList>("/traefik/middlewares");
    return res.data;
  },
};
