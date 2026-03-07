import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  redirectApi,
  RedirectHostCreate,
  RedirectHostUpdate,
} from "../api/redirectApi";

const QUERY_KEY = ["redirect-hosts"];

export function useRedirectHosts() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: redirectApi.list,
  });
}

export function useCreateRedirectHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RedirectHostCreate) => redirectApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateRedirectHost(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RedirectHostUpdate) => redirectApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteRedirectHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => redirectApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
