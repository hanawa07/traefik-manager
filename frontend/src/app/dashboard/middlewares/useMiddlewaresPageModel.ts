"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import {
  useAssignMiddlewareTemplate,
  useCreateMiddlewareTemplate,
  useDeleteMiddlewareTemplate,
  useMiddlewareTemplates,
  useUpdateMiddlewareTemplate,
} from "@/features/middlewares/hooks/useMiddlewares";
import type { Service } from "@/features/services/api/serviceApi";
import { useServices } from "@/features/services/hooks/useServices";
import { useTraefikMiddlewares } from "@/features/traefik/hooks/useTraefik";
import {
  buildGeneratedMiddlewareItems,
  extractErrorMessage,
  generatedSearchValue,
  type MiddlewareTab,
} from "./middlewarePageHelpers";

export function useMiddlewaresPageModel() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const [activeTab, setActiveTab] = useState<MiddlewareTab>("templates");
  const [generatedSearch, setGeneratedSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MiddlewareTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MiddlewareTemplate | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<MiddlewareTemplate | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

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
  const createTemplate = useCreateMiddlewareTemplate();
  const deleteTemplate = useDeleteMiddlewareTemplate();
  const updateTemplate = useUpdateMiddlewareTemplate(editTarget?.id || "");
  const assignTemplate = useAssignMiddlewareTemplate(assignmentTarget?.id || "");

  const runtimeConnected = runtimeMiddlewaresResponse?.connected ?? false;
  const runtimeMap = useMemo(
    () =>
      new Map(
        (runtimeMiddlewaresResponse?.middlewares ?? []).map((middleware) => [middleware.name, middleware]),
      ),
    [runtimeMiddlewaresResponse?.middlewares],
  );

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [templates],
  );

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [services],
  );

  const appliedServicesByTemplate = useMemo(() => {
    const initial = Object.fromEntries(sortedTemplates.map((template) => [template.id, [] as Service[]]));
    for (const service of sortedServices) {
      for (const templateId of service.middleware_template_ids) {
        if (initial[templateId]) {
          initial[templateId].push(service);
        }
      }
    }
    return initial;
  }, [sortedServices, sortedTemplates]);

  useEffect(() => {
    if (!assignmentTarget) {
      setAssignmentSearch("");
      setSelectedServiceIds([]);
      return;
    }
    setAssignmentSearch("");
    setSelectedServiceIds((appliedServicesByTemplate[assignmentTarget.id] || []).map((service) => service.id));
  }, [assignmentTarget?.id, assignmentTarget, appliedServicesByTemplate]);

  const filteredServicesForAssignment = useMemo(() => {
    const query = generatedSearchValue(assignmentSearch);
    if (!query) return sortedServices;
    return sortedServices.filter((service) => generatedSearchValue(`${service.name} ${service.domain}`).includes(query));
  }, [assignmentSearch, sortedServices]);

  const generatedServiceGroups = useMemo(() => {
    const query = generatedSearchValue(generatedSearch);

    return sortedServices
      .map((service) => ({
        service,
        items: buildGeneratedMiddlewareItems(service, runtimeMap, runtimeConnected),
      }))
      .filter(({ service, items }) => {
        if (items.length === 0) return false;
        if (!query) return true;
        return generatedSearchValue(`${service.name} ${service.domain}`).includes(query);
      });
  }, [generatedSearch, runtimeConnected, runtimeMap, sortedServices]);

  const runtimeBannerMessage = runtimeError
    ? extractErrorMessage(runtimeError, "Traefik 런타임 미들웨어 상태를 불러오지 못했습니다")
    : runtimeConnected
      ? null
      : runtimeMiddlewaresResponse?.message || "Traefik 연결 상태를 아직 확인하지 못했습니다";
  const sharedTabBlocked = isTemplateError || isServicesError;
  const sharedTabErrorMessage = isTemplateError
    ? extractErrorMessage(templateError, "미들웨어 템플릿을 불러오지 못했습니다")
    : extractErrorMessage(servicesError, "서비스 목록을 불러오지 못했습니다");

  return {
    pageHeader: {
      activeTab,
      canManage,
      templatesCount: templates.length,
      onCreateOpen: () => setIsCreateOpen(true),
      onTabChange: setActiveTab,
    },
    sharedTab: {
      canManage,
      runtimeConnected,
      runtimeBannerMessage,
      isTemplateLoading,
      isServicesLoading,
      sharedTabBlocked,
      sharedTabErrorMessage,
      sortedTemplates,
      appliedServicesByTemplate,
      runtimeMap,
      onCreateOpen: () => setIsCreateOpen(true),
      onEdit: setEditTarget,
      onDelete: setDeleteTarget,
      onAssign: setAssignmentTarget,
    },
    generatedTab: {
      generatedSearch,
      onGeneratedSearchChange: setGeneratedSearch,
      runtimeBannerMessage,
      isServicesLoading,
      isRuntimeLoading,
      isServicesError,
      servicesError,
      generatedServiceCount: generatedServiceGroups.length,
      generatedServiceGroups,
    },
    modals: {
      canManage,
      isCreateOpen,
      editTarget,
      deleteTarget,
      assignmentTarget,
      assignmentSearch,
      selectedServiceIds,
      services,
      filteredServicesForAssignment,
      createTemplate,
      updateTemplate,
      deleteTemplate,
      assignTemplate,
      onCreateClose: () => setIsCreateOpen(false),
      onEditClose: () => setEditTarget(null),
      onDeleteClose: () => setDeleteTarget(null),
      onAssignmentClose: () => setAssignmentTarget(null),
      onAssignmentSearchChange: setAssignmentSearch,
      onToggleService: (serviceId: string) =>
        setSelectedServiceIds((current) =>
          current.includes(serviceId)
            ? current.filter((id) => id !== serviceId)
            : [...current, serviceId],
        ),
    },
  };
}
