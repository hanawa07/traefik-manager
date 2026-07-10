import type { RedirectHost } from "@/features/redirects/api/redirectApi";

import { RedirectsEmptyState } from "./RedirectsEmptyState";
import { RedirectsLoadingRows } from "./RedirectsLoadingRows";
import { RedirectsTable } from "./RedirectsTable";

interface RedirectsListCardProps {
  canManage: boolean;
  isLoading: boolean;
  redirects: RedirectHost[];
  onCreate: () => void;
  onEdit: (redirect: RedirectHost) => void;
  onDelete: (redirect: RedirectHost) => void;
}

export function RedirectsListCard({
  canManage,
  isLoading,
  redirects,
  onCreate,
  onEdit,
  onDelete,
}: RedirectsListCardProps) {
  return (
    <div className="card overflow-hidden">
      {isLoading ? (
        <RedirectsLoadingRows />
      ) : redirects.length === 0 ? (
        <RedirectsEmptyState canManage={canManage} onCreate={onCreate} />
      ) : (
        <div className="overflow-x-auto" data-testid="redirects-table-scroll">
          <RedirectsTable
            canManage={canManage}
            redirects={redirects}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  );
}
