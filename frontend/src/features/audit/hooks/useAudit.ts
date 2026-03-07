import { useQuery } from "@tanstack/react-query";
import { auditApi } from "../api/auditApi";

export const useAudit = (params?: {
  limit?: number;
  offset?: number;
  resource_type?: string;
}) => {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => auditApi.getLogs(params),
  });
};
