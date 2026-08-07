import type { RedirectHost } from "@/features/redirects/api/redirectApi";

import { RedirectsEmptyState } from "./RedirectsEmptyState";
import { RedirectsErrorState } from "./RedirectsErrorState";
import { RedirectsLoadingRows } from "./RedirectsLoadingRows";
import { RedirectsTable } from "./RedirectsTable";

interface RedirectsListCardProps {
  canManage: boolean;
  errorMessage: string;
  isError: boolean;
  isLoading: boolean;
  isRetrying: boolean;
  redirects: RedirectHost[];
  onCreate: () => void;
  onEdit: (redirect: RedirectHost) => void;
  onDelete: (redirect: RedirectHost) => void;
  onRetry: () => void;
}

export function RedirectsListCard({
  canManage,
  errorMessage,
  isError,
  isLoading,
  isRetrying,
  redirects,
  onCreate,
  onEdit,
  onDelete,
  onRetry,
}: RedirectsListCardProps) {
  return (
    <div className="card overflow-hidden">
      {isLoading ? (
        <RedirectsLoadingRows />
      ) : isError ? (
        <RedirectsErrorState
          isRetrying={isRetrying}
          message={errorMessage}
          onRetry={onRetry}
        />
      ) : redirects.length === 0 ? (
        <RedirectsEmptyState canManage={canManage} onCreate={onCreate} />
      ) : (
        <div className="overflow-x-auto" data-table-scroll="redirects" data-testid="redirects-table-scroll">
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
