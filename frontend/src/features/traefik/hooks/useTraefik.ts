import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { traefikApi } from "../api/traefikApi";

const TRAEFIK_HEALTH_QUERY_KEY = ["traefik-health"];
const TRAEFIK_DEPLOYMENT_QUERY_KEY = ["traefik-deployment"];

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
