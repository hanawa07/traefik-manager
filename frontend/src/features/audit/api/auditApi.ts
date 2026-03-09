import apiClient from "@/shared/lib/apiClient";

export interface AuditLogItem {
  id: string;
  actor: string;
  action: "create" | "update" | "delete";
  resource_type: "service" | "redirect" | "middleware" | "user";
  resource_id: string;
  resource_name: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export const auditApi = {
  getLogs: async (params?: {
    limit?: number;
    offset?: number;
    resource_type?: string;
  }): Promise<AuditLogItem[]> => {
    const res = await apiClient.get<AuditLogItem[]>("/audit", { params });
    return res.data;
  },
};
