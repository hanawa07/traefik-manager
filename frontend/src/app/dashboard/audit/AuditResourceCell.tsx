import { clsx } from "clsx";

import {
  fallbackResourceIcon,
  resourceTypeConfig,
} from "./auditPageHelpers";

export function AuditResourceCell({ resourceType }: { resourceType: string }) {
  const resource = resourceTypeConfig[resourceType];
  const ResourceIcon = resource?.icon || fallbackResourceIcon;

  return (
    <div className="flex items-center gap-2">
      <div className={clsx("rounded-lg p-1.5", resource?.color)}>
        <ResourceIcon className="h-3.5 w-3.5" />
      </div>
      <span className="text-sm font-medium text-slate-900">
        {resource?.label || resourceType}
      </span>
    </div>
  );
}
