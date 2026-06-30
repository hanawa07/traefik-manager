import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareItem } from "@/features/traefik/api/traefikApi";

import SharedMiddlewareTemplateList from "./SharedMiddlewareTemplateList";
import {
  RuntimeStatusBanner,
  SharedMiddlewareEmptyState,
  SharedMiddlewareErrorState,
  SharedMiddlewareLoadingState,
} from "./SharedMiddlewareTemplatesStatusPanels";

interface SharedMiddlewareTemplatesTabProps {
  canManage: boolean;
  runtimeConnected: boolean;
  runtimeBannerMessage: string | null;
  isTemplateLoading: boolean;
  isServicesLoading: boolean;
  sharedTabBlocked: boolean;
  sharedTabErrorMessage: string;
  sortedTemplates: MiddlewareTemplate[];
  appliedServicesByTemplate: Record<string, Service[]>;
  runtimeMap: Map<string, TraefikMiddlewareItem>;
  onCreateOpen: () => void;
  onEdit: (template: MiddlewareTemplate) => void;
  onDelete: (template: MiddlewareTemplate) => void;
  onAssign: (template: MiddlewareTemplate) => void;
}

export default function SharedMiddlewareTemplatesTab({
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
  onCreateOpen,
  onEdit,
  onDelete,
  onAssign,
}: SharedMiddlewareTemplatesTabProps) {
  return (
    <div className="space-y-4">
      <RuntimeStatusBanner message={runtimeBannerMessage} />

      {isTemplateLoading || isServicesLoading ? (
        <SharedMiddlewareLoadingState />
      ) : sharedTabBlocked ? (
        <SharedMiddlewareErrorState message={sharedTabErrorMessage} />
      ) : sortedTemplates.length === 0 ? (
        <SharedMiddlewareEmptyState canManage={canManage} onCreateOpen={onCreateOpen} />
      ) : (
        <SharedMiddlewareTemplateList
          canManage={canManage}
          runtimeConnected={runtimeConnected}
          templates={sortedTemplates}
          appliedServicesByTemplate={appliedServicesByTemplate}
          runtimeMap={runtimeMap}
          onEdit={onEdit}
          onDelete={onDelete}
          onAssign={onAssign}
        />
      )}
    </div>
  );
}
