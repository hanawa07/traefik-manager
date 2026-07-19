import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  serviceApi,
  type RoutingMode,
  type Service,
  type ServiceCreate,
  type ServiceUpdate,
} from "../api/serviceApi";
import { applyRoutingModeUpdates, getRoutingUpdateTargets } from "../lib/serviceRouting";

const QUERY_KEY = ["services"];
const AUTHENTIK_GROUPS_QUERY_KEY = ["authentik-groups"];
const TRAEFIK_ROUTER_STATUS_QUERY_KEY = ["traefik-router-status"];
const AUDIT_LOGS_QUERY_KEY = ["audit-logs"];

export function useServices() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: serviceApi.list,
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: () => serviceApi.get(id),
    enabled: !!id,
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ServiceCreate) => serviceApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: TRAEFIK_ROUTER_STATUS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, "health-all"] });
    },
  });
}

export function useUpdateService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ServiceUpdate) => serviceApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, id] });
      qc.invalidateQueries({ queryKey: TRAEFIK_ROUTER_STATUS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, "health-all"] });
    },
  });
}

export function useBulkUpdateServiceRoutingMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      services,
      selectedServiceIds,
      routingMode,
    }: {
      services: Service[];
      selectedServiceIds: string[];
      routingMode: RoutingMode;
    }) => {
      const targets = getRoutingUpdateTargets(services, selectedServiceIds, routingMode);
      const { successCount, failedCount } = await applyRoutingModeUpdates(
        targets,
        routingMode,
        (serviceId, mode) => serviceApi.update(serviceId, { routing_mode: mode }),
      );
      if (failedCount > 0) {
        throw new Error(`${successCount}개 적용, ${failedCount}개 실패`);
      }
      return successCount;
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: QUERY_KEY }),
        qc.invalidateQueries({ queryKey: TRAEFIK_ROUTER_STATUS_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: [...QUERY_KEY, "health-all"] }),
      ]);
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => serviceApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAuthentikGroups(enabled = true) {
  return useQuery({
    queryKey: AUTHENTIK_GROUPS_QUERY_KEY,
    queryFn: serviceApi.listAuthentikGroups,
    enabled,
    staleTime: 60_000,
  });
}

export function useAllServicesHealth() {
  return useQuery({
    queryKey: [...QUERY_KEY, "health-all"],
    queryFn: serviceApi.getAllServicesHealth,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
}

export function useDiagnoseServiceGateway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => serviceApi.recordGatewayDiagnosis(id),
    onSuccess: () => {
      invalidateGatewayDiagnosisContext(qc);
    },
  });
}

export function useConnectServiceGatewayNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => serviceApi.connectGatewayNetwork(id),
    onSuccess: () => {
      invalidateGatewayDiagnosisContext(qc);
    },
  });
}

function invalidateGatewayDiagnosisContext(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [...QUERY_KEY, "health-all"] });
  qc.invalidateQueries({ queryKey: TRAEFIK_ROUTER_STATUS_QUERY_KEY });
  qc.invalidateQueries({ queryKey: AUDIT_LOGS_QUERY_KEY });
}
