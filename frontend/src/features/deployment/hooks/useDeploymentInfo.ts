import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deploymentApi,
  type ManagerHttpErrorWindowHours,
} from "../api/deploymentApi";

const QUERY_KEY = ["deployment-info"];

export function useDeploymentInfo() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => deploymentApi.getInfo(),
    refetchInterval: 30_000,
  });
}

export function useManagerHttpErrors(
  windowHours: ManagerHttpErrorWindowHours,
  path: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["manager-http-errors", windowHours, path],
    queryFn: () => deploymentApi.getHttpErrors({ windowHours, path }),
    enabled,
    placeholderData: (previousData) => previousData,
    refetchInterval: 30_000,
  });
}

export function useRefreshDeploymentLatest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deploymentApi.getInfo({ refreshLatest: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });
}
