import { useQuery } from "@tanstack/react-query";

import { traefikApi } from "../api/traefikApi";

export function useTraefikHealth() {
  return useQuery({
    queryKey: ["traefik-health"],
    queryFn: traefikApi.health,
    refetchInterval: 10_000,
  });
}

export function useTraefikRouterStatus() {
  return useQuery({
    queryKey: ["traefik-router-status"],
    queryFn: traefikApi.routerStatus,
    refetchInterval: 10_000,
  });
}
