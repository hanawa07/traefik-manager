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
    isFetching: isTemplateFetching,
    isLoading: isTemplateLoading,
    refetch: refetchTemplates,
  } = useMiddlewareTemplates();
  const {
    data: services = [],
    error: servicesError,
    isError: isServicesError,
    isFetching: isServicesFetching,
    isLoading: isServicesLoading,
    refetch: refetchServices,
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
    isServicesFetching,
    isServicesLoading,
    isTemplateError,
    isTemplateFetching,
    isTemplateLoading,
    refetchServices,
    refetchTemplates,
    runtimeError,
    runtimeMiddlewaresResponse,
    services,
    servicesError,
    templateError,
    templates,
    updateTemplate,
  };
}
