import { useQuery } from "@tanstack/react-query";

import { dockerApi } from "../api/dockerApi";

const QUERY_KEY = ["docker-containers"];

export function useDockerContainers(enabled = false) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: dockerApi.listContainers,
    enabled,
    staleTime: 30_000,
  });
}
