import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuditDeliveryRetryResult, auditApi } from "../api/auditApi";

export const useAudit = (params?: {
  limit?: number;
  offset?: number;
  resource_type?: string;
  action?: string;
  event?: string;
  security_only?: boolean;
  provider?: string;
  delivery_success?: boolean;
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
