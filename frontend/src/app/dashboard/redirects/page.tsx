"use client";

import { RedirectCreateModal } from "./RedirectCreateModal";
import { RedirectDeleteModal } from "./RedirectDeleteModal";
import { RedirectEditModal } from "./RedirectEditModal";
import { RedirectsListCard } from "./RedirectsListCard";
import { RedirectsPageHeader } from "./RedirectsPageHeader";
import { useRedirectsPageModel } from "./useRedirectsPageModel";

export default function RedirectsPage() {
  const page = useRedirectsPageModel();

  return (
    <div>
      <RedirectsPageHeader
        canManage={page.canManage}
        redirectCount={page.redirects.length}
        onCreate={page.onOpenCreate}
      />
      <RedirectsListCard
        canManage={page.canManage}
        isLoading={page.isLoading}
        redirects={page.redirects}
        onCreate={page.onOpenCreate}
        onEdit={page.onEdit}
        onDelete={page.onDelete}
      />
      <RedirectCreateModal
        canManage={page.canManage}
        isOpen={page.isCreateOpen}
        errorMessage={page.createErrorMessage}
        isSubmitting={page.isCreating}
        onClose={page.onCloseCreate}
        onSubmit={page.onCreate}
      />
      <RedirectEditModal
        canManage={page.canManage}
        editTarget={page.editTarget}
        errorMessage={page.updateErrorMessage}
        isSubmitting={page.isUpdating}
        onClose={page.onCloseEdit}
        onSubmit={page.onUpdate}
      />
      <RedirectDeleteModal
        canManage={page.canManage}
        deleteTarget={page.deleteTarget}
        isDeleting={page.isDeleting}
        onClose={page.onCloseDelete}
        onConfirm={page.onConfirmDelete}
      />
    </div>
  );
}
