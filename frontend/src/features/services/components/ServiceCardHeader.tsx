import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import type { Service } from "../api/serviceApi";

interface ServiceCardHeaderProps {
  service: Service;
  canManage: boolean;
  onDelete: (service: Service) => void;
}

export default function ServiceCardHeader({ service, canManage, onDelete }: ServiceCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="truncate font-semibold text-gray-900">{service.name}</h3>
          <a
            href={`${service.tls_enabled ? "https" : "http"}://${service.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 transition-colors hover:text-blue-500"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="truncate text-sm text-gray-500">{service.domain}</p>
        <p className="mt-1 text-xs text-gray-400">
          → {service.upstream_host}:{service.upstream_port}
        </p>
      </div>

      {canManage ? (
        <div className="flex flex-shrink-0 items-center gap-1">
          <Link
            href={`/dashboard/services/${service.id}`}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => onDelete(service)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
