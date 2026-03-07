import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceApi, ServiceCreate, ServiceUpdate } from "../api/serviceApi";

const QUERY_KEY = ["services"];
const AUTHENTIK_GROUPS_QUERY_KEY = ["authentik-groups"];

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
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ServiceUpdate) => serviceApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
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
