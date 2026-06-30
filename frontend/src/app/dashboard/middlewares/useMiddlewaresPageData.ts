"use client";

import {
  useAssignMiddlewareTemplate,
  useCreateMiddlewareTemplate,
  useDeleteMiddlewareTemplate,
  useMiddlewareTemplates,
  useUpdateMiddlewareTemplate,
} from "@/features/middlewares/hooks/useMiddlewares";
import { useServices } from "@/features/services/hooks/useServices";
import { useTraefikMiddlewares } from "@/features/traefik/hooks/useTraefik";

interface UseMiddlewaresPageDataArgs {
  assignmentTemplateId: string;
  editTemplateId: string;
}

export function useMiddlewaresPageData({
  assignmentTemplateId,
  editTemplateId,
}: UseMiddlewaresPageDataArgs) {
  const {
    data: templates = [],
    error: templateError,
    isError: isTemplateError,
    isLoading: isTemplateLoading,
  } = useMiddlewareTemplates();
  const {
    data: services = [],
    error: servicesError,
    isError: isServicesError,
    isLoading: isServicesLoading,
  } = useServices();
  const {
    data: runtimeMiddlewaresResponse,
    error: runtimeError,
    isLoading: isRuntimeLoading,
  } = useTraefikMiddlewares();
  const assignTemplate = useAssignMiddlewareTemplate(assignmentTemplateId);
  const createTemplate = useCreateMiddlewareTemplate();
  const deleteTemplate = useDeleteMiddlewareTemplate();
  const updateTemplate = useUpdateMiddlewareTemplate(editTemplateId);

  return {
    assignTemplate,
    createTemplate,
    deleteTemplate,
    isRuntimeLoading,
    isServicesError,
    isServicesLoading,
    isTemplateError,
    isTemplateLoading,
    runtimeError,
    runtimeMiddlewaresResponse,
    services,
    servicesError,
    templateError,
    templates,
    updateTemplate,
  };
}
