import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  middlewareApi,
  MiddlewareTemplateCreate,
  MiddlewareTemplateUpdate,
} from "../api/middlewareApi";

const QUERY_KEY = ["middleware-templates"];

export function useMiddlewareTemplates() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: middlewareApi.list,
  });
}

export function useCreateMiddlewareTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MiddlewareTemplateCreate) => middlewareApi.create(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateMiddlewareTemplate(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MiddlewareTemplateUpdate) => middlewareApi.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteMiddlewareTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => middlewareApi.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
}
