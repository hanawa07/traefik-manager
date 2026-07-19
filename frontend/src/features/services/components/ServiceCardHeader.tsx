import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import type { Service } from "../api/serviceApi";

interface ServiceCardHeaderProps {
  service: Service;
  canManage: boolean;
  selected?: boolean;
  onSelectionChange?: (service: Service, selected: boolean) => void;
  onDelete: (service: Service) => void;
}

export default function ServiceCardHeader({
  service,
  canManage,
  selected = false,
  onSelectionChange,
  onDelete,
}: ServiceCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="truncate font-semibold text-gray-900 dark:text-slate-100">{service.name}</h3>
          <a
            href={`${service.tls_enabled ? "https" : "http"}://${service.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 transition-colors hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="truncate text-sm text-gray-500 dark:text-slate-400">{service.domain}</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
          → {service.upstream_host}:{service.upstream_port}
        </p>
      </div>

      {canManage ? (
        <div className="flex flex-shrink-0 items-center gap-1">
          {onSelectionChange ? (
            <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="sr-only">{service.name} 선택</span>
              <input
                checked={selected}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                onChange={(event) => onSelectionChange(service, event.target.checked)}
                type="checkbox"
              />
            </label>
          ) : null}
          <Link
            href={`/dashboard/services/${service.id}`}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => onDelete(service)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
