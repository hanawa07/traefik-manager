"use client";

import { useEffect, useState } from "react";

import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";

import type { MiddlewareTab } from "./middlewarePageHelpers";
import { isTemplateStatusFilter, type TemplateStatusFilter } from "./middlewareTemplateFilters";

interface MiddlewarePageUrlState {
  activeTab: MiddlewareTab;
  generatedSearch: string;
  templateSearch: string;
  templateStatusFilter: TemplateStatusFilter;
}

function readMiddlewarePageUrlState(): MiddlewarePageUrlState {
  if (typeof window === "undefined") {
    return {
      activeTab: "templates",
      generatedSearch: "",
      templateSearch: "",
      templateStatusFilter: "all",
    };
  }

  const params = new URLSearchParams(window.location.search);
  const activeTab = params.get("tab") === "generated" ? "generated" : "templates";
  const search = params.get("search") ?? "";
  const status = params.get("status");

  return {
    activeTab,
    generatedSearch: activeTab === "generated" ? search : "",
    templateSearch: activeTab === "templates" ? search : "",
    templateStatusFilter:
      activeTab === "templates" && isTemplateStatusFilter(status) ? status : "all",
  };
}

function replaceMiddlewarePageUrl({
  activeTab,
  generatedSearch,
  templateSearch,
  templateStatusFilter,
}: MiddlewarePageUrlState) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (activeTab === "generated") {
    url.searchParams.set("tab", "generated");
    const trimmedSearch = generatedSearch.trim();
    if (trimmedSearch) {
      url.searchParams.set("search", trimmedSearch);
    } else {
      url.searchParams.delete("search");
    }
  } else {
    url.searchParams.delete("tab");
    const trimmedSearch = templateSearch.trim();
    if (trimmedSearch) {
      url.searchParams.set("search", trimmedSearch);
    } else {
      url.searchParams.delete("search");
    }
    if (templateStatusFilter === "all") {
      url.searchParams.delete("status");
    } else {
      url.searchParams.set("status", templateStatusFilter);
    }
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

export function useMiddlewaresPageUiState() {
  const [activeTab, setActiveTab] = useState<MiddlewareTab>("templates");
  const [generatedSearch, setGeneratedSearch] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateStatusFilter, setTemplateStatusFilter] = useState<TemplateStatusFilter>("all");
  const [isUrlReady, setIsUrlReady] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MiddlewareTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MiddlewareTemplate | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<MiddlewareTemplate | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  useEffect(() => {
    function applyUrlState() {
      const urlState = readMiddlewarePageUrlState();
      setActiveTab(urlState.activeTab);
      setGeneratedSearch(urlState.generatedSearch);
      setTemplateSearch(urlState.templateSearch);
      setTemplateStatusFilter(urlState.templateStatusFilter);
    }

    applyUrlState();
    setIsUrlReady(true);
    window.addEventListener("popstate", applyUrlState);

    return () => window.removeEventListener("popstate", applyUrlState);
  }, []);

  useEffect(() => {
    if (!isUrlReady) {
      return;
    }

    replaceMiddlewarePageUrl({
      activeTab,
      generatedSearch,
      templateSearch,
      templateStatusFilter,
    });
  }, [activeTab, generatedSearch, isUrlReady, templateSearch, templateStatusFilter]);

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
    setTemplateSearch,
    setTemplateStatusFilter,
    templateSearch,
    templateStatusFilter,
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
