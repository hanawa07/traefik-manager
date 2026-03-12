import apiClient from "@/shared/lib/apiClient";

export interface AuditLogItem {
  id: string;
  actor: string;
  action: "create" | "update" | "delete" | "test" | string;
  resource_type: "service" | "redirect" | "middleware" | "user" | "settings" | string;
  resource_id: string;
  resource_name: string;
  detail: Record<string, unknown> | null;
  event?: string | null;
  created_at: string;
}

export interface AuditSecurityEventItem {
  id: string;
  event: string;
  actor: string;
  resource_name: string;
  client_ip: string | null;
  created_at: string;
}

export interface AuditSecuritySummary {
  window_minutes: number;
  failed_login_count: number;
  locked_login_count: number;
  suspicious_ip_count: number;
  blocked_ip_count: number;
  recent_events: AuditSecurityEventItem[];
}

export const auditApi = {
  getLogs: async (params?: {
    limit?: number;
    offset?: number;
    resource_type?: string;
    action?: string;
    event?: string;
    security_only?: boolean;
  }): Promise<AuditLogItem[]> => {
    const res = await apiClient.get<AuditLogItem[]>("/audit", { params });
    return res.data;
  },

  getSecuritySummary: async (params?: {
    window_minutes?: number;
    recent_limit?: number;
  }): Promise<AuditSecuritySummary> => {
    const res = await apiClient.get<AuditSecuritySummary>("/audit/security-summary", { params });
    return res.data;
  },

  rollbackChange: async (
    resourceType: "settings" | "service" | "redirect",
    auditLogId: string,
  ): Promise<Record<string, unknown>> => {
    const endpoint =
      resourceType === "settings"
        ? `/settings/rollback/${auditLogId}`
        : resourceType === "service"
          ? `/services/rollback/${auditLogId}`
          : `/redirects/rollback/${auditLogId}`;
    const res = await apiClient.post<Record<string, unknown>>(endpoint);
    return res.data;
  },
};
