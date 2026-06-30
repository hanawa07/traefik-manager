"use client";

import { useEffect, useState } from "react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";

import type { MiddlewareTab } from "./middlewarePageHelpers";

export function useMiddlewaresPageUiState() {
  const [activeTab, setActiveTab] = useState<MiddlewareTab>("templates");
  const [generatedSearch, setGeneratedSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MiddlewareTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MiddlewareTemplate | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<MiddlewareTemplate | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  };

  return {
    activeTab,
    assignmentSearch,
    assignmentTarget,
    closeAssignment: () => setAssignmentTarget(null),
    closeCreate: () => setIsCreateOpen(false),
    closeDelete: () => setDeleteTarget(null),
    closeEdit: () => setEditTarget(null),
    deleteTarget,
    editTarget,
    generatedSearch,
    isCreateOpen,
    openCreate: () => setIsCreateOpen(true),
    selectedServiceIds,
    setActiveTab,
    setAssignmentSearch,
    setAssignmentTarget,
    setDeleteTarget,
    setEditTarget,
    setGeneratedSearch,
    setSelectedServiceIds,
    toggleServiceSelection,
  };
}

export function useSyncMiddlewareAssignmentSelection({
  appliedServicesByTemplate,
  assignmentTarget,
  setAssignmentSearch,
  setSelectedServiceIds,
}: {
  appliedServicesByTemplate: Record<string, Service[]>;
  assignmentTarget: MiddlewareTemplate | null;
  setAssignmentSearch: (value: string) => void;
  setSelectedServiceIds: (value: string[]) => void;
}) {
  useEffect(() => {
    if (!assignmentTarget) {
      setAssignmentSearch("");
      setSelectedServiceIds([]);
      return;
    }
    setAssignmentSearch("");
    setSelectedServiceIds((appliedServicesByTemplate[assignmentTarget.id] || []).map((service) => service.id));
  }, [assignmentTarget?.id, assignmentTarget, appliedServicesByTemplate, setAssignmentSearch, setSelectedServiceIds]);
}
