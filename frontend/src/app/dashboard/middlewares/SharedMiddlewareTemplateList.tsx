import type { MiddlewareTemplate } from "@/features/middlewares/api/middlewareApi";
import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikMiddlewareItem } from "@/features/traefik/api/traefikApi";

import SharedMiddlewareTemplateCard from "./SharedMiddlewareTemplateCard";

interface SharedMiddlewareTemplateListProps {
  canManage: boolean;
  runtimeConnected: boolean;
  templates: MiddlewareTemplate[];
  appliedServicesByTemplate: Record<string, Service[]>;
  runtimeMap: Map<string, TraefikMiddlewareItem>;
  onEdit: (template: MiddlewareTemplate) => void;
  onDelete: (template: MiddlewareTemplate) => void;
  onAssign: (template: MiddlewareTemplate) => void;
}

export default function SharedMiddlewareTemplateList({
  canManage,
  runtimeConnected,
  templates,
  appliedServicesByTemplate,
  runtimeMap,
  onEdit,
  onDelete,
  onAssign,
}: SharedMiddlewareTemplateListProps) {
  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <SharedMiddlewareTemplateCard
          key={template.id}
          canManage={canManage}
          runtimeConnected={runtimeConnected}
          template={template}
          appliedServices={appliedServicesByTemplate[template.id] || []}
          runtimeMap={runtimeMap}
          onEdit={onEdit}
          onDelete={onDelete}
          onAssign={onAssign}
        />
      ))}
    </div>
  );
}
