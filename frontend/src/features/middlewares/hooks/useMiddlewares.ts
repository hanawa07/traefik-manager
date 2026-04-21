import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  middlewareApi,
  MiddlewareTemplateCreate,
  MiddlewareTemplateUpdate,
} from "../api/middlewareApi";
import { serviceApi, Service } from "@/features/services/api/serviceApi";

const QUERY_KEY = ["middleware-templates"];
const TRAEFIK_MIDDLEWARES_QUERY_KEY = ["traefik-runtime-middlewares"];

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
      await queryClient.invalidateQueries({ queryKey: TRAEFIK_MIDDLEWARES_QUERY_KEY });
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
      await queryClient.invalidateQueries({ queryKey: TRAEFIK_MIDDLEWARES_QUERY_KEY });
    },
  });
}

export function useAssignMiddlewareTemplate(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      services,
      selectedServiceIds,
    }: {
      services: Service[];
      selectedServiceIds: string[];
    }) => {
      const selected = new Set(selectedServiceIds);
      const changedServices = services.filter((service) => {
        const hasTemplate = service.middleware_template_ids.includes(templateId);
        return selected.has(service.id) !== hasTemplate;
      });

      await Promise.all(
        changedServices.map((service) => {
          const nextTemplateIds = selected.has(service.id)
            ? [...service.middleware_template_ids, templateId]
            : service.middleware_template_ids.filter((id) => id !== templateId);

          return serviceApi.update(service.id, {
            middleware_template_ids: nextTemplateIds,
          });
        })
      );

      return changedServices.length;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: TRAEFIK_MIDDLEWARES_QUERY_KEY });
    },
  });
}
