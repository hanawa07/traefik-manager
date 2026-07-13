import apiClient from "@/shared/lib/apiClient";
import {
  getAuditRollbackEndpoint,
  type AuditRollbackResourceType,
} from "./auditRollbackEndpoints";

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

export interface AuditLogQueryParams {
  limit?: number;
  offset?: number;
  resource_type?: string;
  action?: string;
  event?: string;
  manager_status?: "unhealthy" | "recovered";
  manager_source?: "docker" | "api" | "watchdog";
  period_days?: 1 | 7 | 30 | 90;
  start_date?: string;
  end_date?: string;
  search?: string;
  security_only?: boolean;
  provider?: string;
  delivery_success?: boolean;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  total: number;
}

export function buildAuditExportUrl(params: AuditLogQueryParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  return `${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/audit/export.csv?${query}`;
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

export interface AuditCertificateEventItem {
  id: string;
  event: string;
  actor: string;
  resource_name: string;
  days_remaining: number | null;
  expires_at: string | null;
  previous_status: string | null;
  checked_at: string | null;
  created_at: string;
}

export interface AuditCertificateSummary {
  window_minutes: number;
  warning_count: number;
  error_count: number;
  recovered_count: number;
  recent_events: AuditCertificateEventItem[];
}

export interface AuditManagerHealthSummary {
  window_minutes: number;
  unhealthy_count: number;
  recovered_count: number;
  docker_unhealthy_count: number;
  docker_recovered_count: number;
  api_unhealthy_count: number;
  api_recovered_count: number;
  watchdog_unhealthy_count: number;
  watchdog_recovered_count: number;
}

export interface AuditDeliveryRetryResult {
  success: boolean;
  message: string;
  detail: string | null;
  provider: string | null;
  source_event: string | null;
}

export const auditApi = {
  getLogs: async (params?: AuditLogQueryParams): Promise<AuditLogItem[]> => {
    const res = await apiClient.get<AuditLogItem[]>("/audit", { params });
    return res.data;
  },

  getLogPage: async (params: AuditLogQueryParams): Promise<AuditLogPage> => {
    const res = await apiClient.get<AuditLogItem[]>("/audit", { params });
    const total = Number(res.headers["x-total-count"]);
    return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
  },

  getSecuritySummary: async (params?: {
    window_minutes?: number;
    recent_limit?: number;
  }): Promise<AuditSecuritySummary> => {
    const res = await apiClient.get<AuditSecuritySummary>("/audit/security-summary", { params });
    return res.data;
  },

  getCertificateSummary: async (params?: {
    window_minutes?: number;
    recent_limit?: number;
  }): Promise<AuditCertificateSummary> => {
    const res = await apiClient.get<AuditCertificateSummary>("/audit/certificate-summary", { params });
    return res.data;
  },

  getManagerHealthSummary: async (windowMinutes: number): Promise<AuditManagerHealthSummary> => {
    const res = await apiClient.get<AuditManagerHealthSummary>("/audit/manager-health-summary", {
      params: { window_minutes: windowMinutes },
    });
    return res.data;
  },

  rollbackChange: async (
    resourceType: AuditRollbackResourceType,
    auditLogId: string,
  ): Promise<Record<string, unknown>> => {
    const res = await apiClient.post<Record<string, unknown>>(
      getAuditRollbackEndpoint(resourceType, auditLogId),
    );
    return res.data;
  },

  retryDelivery: async (auditLogId: string): Promise<AuditDeliveryRetryResult> => {
    const res = await apiClient.post<AuditDeliveryRetryResult>(`/audit/retry-delivery/${auditLogId}`);
    return res.data;
  },
};
