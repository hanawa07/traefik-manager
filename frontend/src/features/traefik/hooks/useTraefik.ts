import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { traefikApi } from "../api/traefikApi";

const TRAEFIK_HEALTH_QUERY_KEY = ["traefik-health"];
const TRAEFIK_DEPLOYMENT_QUERY_KEY = ["traefik-deployment"];
const TRAEFIK_UPDATE_OPERATIONS_QUERY_KEY = ["traefik-update-operations"];

export function useTraefikHealth() {
  return useQuery({
    queryKey: TRAEFIK_HEALTH_QUERY_KEY,
    queryFn: () => traefikApi.health(),
    refetchInterval: 10_000,
  });
}

export function useRefreshTraefikLatest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => traefikApi.health({ refreshLatest: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(TRAEFIK_HEALTH_QUERY_KEY, data);
      queryClient.invalidateQueries({ queryKey: TRAEFIK_DEPLOYMENT_QUERY_KEY });
    },
  });
}

export function useTraefikDeployment() {
  return useQuery({
    queryKey: TRAEFIK_DEPLOYMENT_QUERY_KEY,
    queryFn: () => traefikApi.deployment(),
    refetchInterval: 30_000,
  });
}

export function useTraefikUpdateOperations() {
  return useQuery({
    queryKey: TRAEFIK_UPDATE_OPERATIONS_QUERY_KEY,
    queryFn: traefikApi.updateOperations,
    refetchInterval: 5_000,
  });
}

export function useRequestTraefikPatchUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetVersion: string) => traefikApi.requestPatchUpdate(targetVersion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAEFIK_UPDATE_OPERATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TRAEFIK_DEPLOYMENT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TRAEFIK_HEALTH_QUERY_KEY });
    },
  });
}

export function useTraefikRouterStatus() {
  return useQuery({
    queryKey: ["traefik-router-status"],
    queryFn: traefikApi.routerStatus,
    refetchInterval: 10_000,
  });
}

export function useTraefikMiddlewares() {
  return useQuery({
    queryKey: ["traefik-runtime-middlewares"],
    queryFn: traefikApi.middlewares,
    refetchInterval: 10_000,
  });
}
