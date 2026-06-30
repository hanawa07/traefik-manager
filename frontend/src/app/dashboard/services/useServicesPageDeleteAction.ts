"use client";

import { useState } from "react";

import type { Service } from "@/features/services/api/serviceApi";
import { useDeleteService } from "@/features/services/hooks/useServices";

export function useServicesPageDeleteAction() {
  const deleteService = useDeleteService();
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteService.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return {
    deletePending: deleteService.isPending,
    deleteTarget,
    handleDelete,
    setDeleteTarget,
  };
}
