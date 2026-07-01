import { useState } from "react";

import { useAuthStore } from "@/features/auth/store/useAuthStore";
import type { RedirectHost, RedirectHostCreate } from "@/features/redirects/api/redirectApi";
import {
  useCreateRedirectHost,
  useDeleteRedirectHost,
  useRedirectHosts,
  useUpdateRedirectHost,
} from "@/features/redirects/hooks/useRedirects";

interface ApiErrorWithDetail {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

export function useRedirectsPageModel() {
  const role = useAuthStore((state) => state.role);
  const canManage = role === "admin";
  const { data: redirects = [], isLoading } = useRedirectHosts();
  const createRedirect = useCreateRedirectHost();
  const deleteRedirect = useDeleteRedirectHost();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RedirectHost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RedirectHost | null>(null);
  const updateRedirect = useUpdateRedirectHost(editTarget?.id || "");

  const handleCreate = async (data: RedirectHostCreate) => {
    await createRedirect.mutateAsync(data);
    setIsCreateOpen(false);
  };

  const handleUpdate = async (data: RedirectHostCreate) => {
    await updateRedirect.mutateAsync(data);
    setEditTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteRedirect.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return {
    canManage,
    redirects,
    isLoading,
    isCreateOpen,
    editTarget,
    deleteTarget,
    createErrorMessage: getRedirectErrorMessage(
      createRedirect.error,
      "리다이렉트 추가 중 오류가 발생했습니다",
    ),
    updateErrorMessage: getRedirectErrorMessage(
      updateRedirect.error,
      "리다이렉트 수정 중 오류가 발생했습니다",
    ),
    isCreating: createRedirect.isPending,
    isUpdating: updateRedirect.isPending,
    isDeleting: deleteRedirect.isPending,
    onOpenCreate: () => setIsCreateOpen(true),
    onCloseCreate: () => setIsCreateOpen(false),
    onEdit: setEditTarget,
    onCloseEdit: () => setEditTarget(null),
    onDelete: setDeleteTarget,
    onCloseDelete: () => setDeleteTarget(null),
    onCreate: handleCreate,
    onUpdate: handleUpdate,
    onConfirmDelete: handleConfirmDelete,
  };
}

function getRedirectErrorMessage(error: unknown, fallback: string) {
  if (!error) return "";

  return (error as ApiErrorWithDetail | null)?.response?.data?.detail || fallback;
}
