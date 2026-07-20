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

export interface TraefikUpdateRunner {
  available: boolean;
  status: "ready" | "running" | "error" | "stale" | "unavailable";
  checked_at: string | null;
  message: string;
}

export interface TraefikUpdateValidation {
  key: string;
  status: "ok" | "fail";
  message: string;
}

export interface TraefikUpdateHistoryEntry {
  request_id: string;
  actor: string;
  status: "running" | "success" | "rejected" | "rolled_back" | "rollback_failed";
  from_version: string;
  target_version: string;
  requested_at: string;
  started_at: string;
  completed_at: string | null;
  message: string;
  backup_dir: string | null;
  backup_created: boolean;
  rollback_performed: boolean;
  alert_request_status: "not_needed" | "pending" | "requested" | "request_failed";
  alert_run_url: string | null;
  alert_retry_actor: string | null;
  alert_retry_requested_at: string | null;
  alert_run_status: string | null;
  alert_run_conclusion: string | null;
  alert_run_checked_at: string | null;
  alert_run_error: string | null;
  validations: TraefikUpdateValidation[];
}

export interface TraefikUpdateOperations {
  runner: TraefikUpdateRunner;
  pending_request: boolean;
  history: TraefikUpdateHistoryEntry[];
}

export interface TraefikUpdateRequestResponse {
  request_id: string;
  target_version: string;
  status: "queued";
  requested_at: string;
  message: string;
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

  updateOperations: async (): Promise<TraefikUpdateOperations> => {
    const res = await apiClient.get<TraefikUpdateOperations>("/traefik/update-operations");
    return res.data;
  },

  requestPatchUpdate: async (targetVersion: string): Promise<TraefikUpdateRequestResponse> => {
    const res = await apiClient.post<TraefikUpdateRequestResponse>("/traefik/update-requests", {
      target_version: targetVersion,
    });
    return res.data;
  },

  retryRollbackAlert: async (requestId: string): Promise<TraefikUpdateRequestResponse> => {
    const res = await apiClient.post<TraefikUpdateRequestResponse>(
      `/traefik/update-operations/${requestId}/alert-retry`,
    );
    return res.data;
  },

  middlewares: async (): Promise<TraefikMiddlewareList> => {
    const res = await apiClient.get<TraefikMiddlewareList>("/traefik/middlewares");
    return res.data;
  },
};
