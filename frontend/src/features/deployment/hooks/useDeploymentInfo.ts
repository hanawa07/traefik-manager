import { useQuery } from "@tanstack/react-query";

import { deploymentApi } from "../api/deploymentApi";

export function useDeploymentInfo() {
  return useQuery({
    queryKey: ["deployment-info"],
    queryFn: deploymentApi.getInfo,
    refetchInterval: 60_000,
  });
}
