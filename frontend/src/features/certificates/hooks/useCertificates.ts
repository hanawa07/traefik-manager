import { useQuery } from "@tanstack/react-query";

import { certificateApi } from "../api/certificateApi";

const QUERY_KEY = ["certificates"];

export function useCertificates() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: certificateApi.list,
    refetchInterval: 60_000,
  });
}
