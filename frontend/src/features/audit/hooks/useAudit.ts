import { useQuery } from "@tanstack/react-query";
import { auditApi } from "../api/auditApi";

export const useAudit = (params?: {
  limit?: number;
  offset?: number;
  resource_type?: string;
  action?: string;
  event?: string;
  security_only?: boolean;
}) => {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => auditApi.getLogs(params),
  });
};

export const useAuditSecuritySummary = (params?: {
  window_minutes?: number;
  recent_limit?: number;
}) => {
  return useQuery({
    queryKey: ["audit-security-summary", params],
    queryFn: () => auditApi.getSecuritySummary(params),
    staleTime: 30_000,
  });
};
