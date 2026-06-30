"use client";

import { useAuthStore } from "@/features/auth/store/useAuthStore";

import { useMiddlewaresPageData } from "./useMiddlewaresPageData";
import { useMiddlewaresPageDerivedModel } from "./useMiddlewaresPageDerivedModel";
import {
  useMiddlewaresPageUiState,
  useSyncMiddlewareAssignmentSelection,
} from "./useMiddlewaresPageUiState";

export function useMiddlewaresPageModel() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const uiState = useMiddlewaresPageUiState();
  const data = useMiddlewaresPageData({
    assignmentTemplateId: uiState.assignmentTarget?.id || "",
    editTemplateId: uiState.editTarget?.id || "",
  });
  const derived = useMiddlewaresPageDerivedModel({
    assignmentSearch: uiState.assignmentSearch,
    generatedSearch: uiState.generatedSearch,
    isServicesError: data.isServicesError,
    isTemplateError: data.isTemplateError,
    runtimeError: data.runtimeError,
    runtimeMiddlewaresResponse: data.runtimeMiddlewaresResponse,
    services: data.services,
    servicesError: data.servicesError,
    templateError: data.templateError,
    templates: data.templates,
  });

  useSyncMiddlewareAssignmentSelection({
    appliedServicesByTemplate: derived.appliedServicesByTemplate,
    assignmentTarget: uiState.assignmentTarget,
    setAssignmentSearch: uiState.setAssignmentSearch,
    setSelectedServiceIds: uiState.setSelectedServiceIds,
  });

  return {
    pageHeader: {
      activeTab: uiState.activeTab,
      canManage,
      templatesCount: data.templates.length,
      onCreateOpen: uiState.openCreate,
      onTabChange: uiState.setActiveTab,
    },
    sharedTab: {
      canManage,
      runtimeConnected: derived.runtimeConnected,
      runtimeBannerMessage: derived.runtimeBannerMessage,
      isTemplateLoading: data.isTemplateLoading,
      isServicesLoading: data.isServicesLoading,
      sharedTabBlocked: derived.sharedTabBlocked,
      sharedTabErrorMessage: derived.sharedTabErrorMessage,
      sortedTemplates: derived.sortedTemplates,
      appliedServicesByTemplate: derived.appliedServicesByTemplate,
      runtimeMap: derived.runtimeMap,
      onCreateOpen: uiState.openCreate,
      onEdit: uiState.setEditTarget,
      onDelete: uiState.setDeleteTarget,
      onAssign: uiState.setAssignmentTarget,
    },
    generatedTab: {
      generatedSearch: uiState.generatedSearch,
      onGeneratedSearchChange: uiState.setGeneratedSearch,
      runtimeBannerMessage: derived.runtimeBannerMessage,
      isServicesLoading: data.isServicesLoading,
      isRuntimeLoading: data.isRuntimeLoading,
      isServicesError: data.isServicesError,
      servicesError: data.servicesError,
      generatedServiceCount: derived.generatedServiceGroups.length,
      generatedServiceGroups: derived.generatedServiceGroups,
    },
    modals: {
      canManage,
      isCreateOpen: uiState.isCreateOpen,
      editTarget: uiState.editTarget,
      deleteTarget: uiState.deleteTarget,
      assignmentTarget: uiState.assignmentTarget,
      assignmentSearch: uiState.assignmentSearch,
      selectedServiceIds: uiState.selectedServiceIds,
      services: data.services,
      filteredServicesForAssignment: derived.filteredServicesForAssignment,
      createTemplate: data.createTemplate,
      updateTemplate: data.updateTemplate,
      deleteTemplate: data.deleteTemplate,
      assignTemplate: data.assignTemplate,
      onCreateClose: uiState.closeCreate,
      onEditClose: uiState.closeEdit,
      onDeleteClose: uiState.closeDelete,
      onAssignmentClose: uiState.closeAssignment,
      onAssignmentSearchChange: uiState.setAssignmentSearch,
      onToggleService: uiState.toggleServiceSelection,
    },
  };
}
