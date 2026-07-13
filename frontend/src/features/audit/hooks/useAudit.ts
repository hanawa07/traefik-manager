import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AuditDeliveryRetryResult,
  type AuditLogQueryParams,
  auditApi,
} from "../api/auditApi";

export const useAudit = (params?: AuditLogQueryParams) => {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => auditApi.getLogs(params),
    placeholderData: (previousData) => previousData,
  });
};

export const useAuditPage = (params: AuditLogQueryParams) => {
  return useQuery({
    queryKey: ["audit-logs", "page", params],
    queryFn: () => auditApi.getLogPage(params),
    placeholderData: (previousData) => previousData,
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

export const useAuditCertificateSummary = (params?: {
  window_minutes?: number;
  recent_limit?: number;
}) => {
  return useQuery({
    queryKey: ["audit-certificate-summary", params],
    queryFn: () => auditApi.getCertificateSummary(params),
    staleTime: 30_000,
  });
};

export const useManagerHealthAudit = (limit = 5) => {
  const params = { limit, resource_type: "manager_component" };
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => auditApi.getLogs(params),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
};

export const useManagerHealthSummary = (windowMinutes: number) => {
  return useQuery({
    queryKey: ["audit-manager-health-summary", windowMinutes],
    queryFn: () => auditApi.getManagerHealthSummary(windowMinutes),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
};

export const useAuditRollback = () => {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    unknown,
    { resourceType: "settings" | "service" | "redirect" | "middleware" | "user"; auditLogId: string }
  >({
    mutationFn: ({ resourceType, auditLogId }) => auditApi.rollbackChange(resourceType, auditLogId),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["services"] }),
        queryClient.invalidateQueries({ queryKey: ["redirect-hosts"] }),
        queryClient.invalidateQueries({ queryKey: ["middleware-templates"] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["traefik-health"] }),
        queryClient.invalidateQueries({ queryKey: ["traefik-router-status"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "time-display"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "upstream-security"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "login-defense"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "security-alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "cloudflare"] }),
      ]);

      if (variables.resourceType === "settings") {
        await queryClient.invalidateQueries({ queryKey: ["settings", "test-history"] });
      }
    },
  });
};

export const useAuditRetryDelivery = () => {
  const queryClient = useQueryClient();
  return useMutation<AuditDeliveryRetryResult, unknown, { auditLogId: string }>({
    mutationFn: ({ auditLogId }) => auditApi.retryDelivery(auditLogId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "test-history"] }),
      ]);
    },
  });
};
