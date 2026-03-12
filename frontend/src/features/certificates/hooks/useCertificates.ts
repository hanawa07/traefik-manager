import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { certificateApi } from "../api/certificateApi";

const QUERY_KEY = ["certificates"];

export function useCertificates() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: certificateApi.list,
    refetchInterval: 60_000,
  });
}

export function useRunCertificateCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: certificateApi.check,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["audit-certificate-summary"] }),
      ]);
    },
  });
}

export function useRunCertificatePreflight() {
  return useMutation({
    mutationFn: (domain: string) => certificateApi.preflight(domain),
  });
}
