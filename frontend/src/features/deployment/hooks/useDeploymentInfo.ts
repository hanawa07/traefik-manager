import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deploymentApi,
  type ManagerHttpErrorWindowHours,
} from "../api/deploymentApi";

export const DEPLOYMENT_INFO_QUERY_KEY = ["deployment-info"] as const;

export function useDeploymentInfo() {
  return useQuery({
    queryKey: DEPLOYMENT_INFO_QUERY_KEY,
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
      queryClient.setQueryData(DEPLOYMENT_INFO_QUERY_KEY, data);
    },
  });
}
