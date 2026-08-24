import type { Service } from "@/features/services/api/serviceApi";
import type { TraefikRouterStatus } from "@/features/traefik/api/traefikApi";

import { DashboardStatusPill } from "./DashboardStatusPill";
import {
  getDashboardRouterStatusClassName,
  getDashboardRouterStatusLabel,
  getDashboardServiceAuthClassName,
  getDashboardServiceAuthLabel,
} from "./dashboardServiceStatusHelpers";

interface DashboardServiceRowProps {
  routerStatus?: TraefikRouterStatus;
  service: Service;
}

export function DashboardServiceRow({ routerStatus, service }: DashboardServiceRowProps) {
  const routerActive = routerStatus?.domains?.[service.domain]?.active;

  return (
    <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/70">
      <td className="break-words px-3 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 sm:px-6">{service.name}</td>
      <td className="break-all px-3 py-3 text-sm text-gray-500 dark:text-slate-400 sm:px-6">{service.domain}</td>
      <td className="hidden px-6 py-3 text-sm text-gray-400 dark:text-slate-500 xl:table-cell">
        {service.upstream_host}:{service.upstream_port}
      </td>
      <td className="hidden px-6 py-3 xl:table-cell">
        <DashboardStatusPill
          label={service.tls_enabled ? "HTTPS" : "HTTP"}
          className={
            service.tls_enabled
              ? "bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-200"
              : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
          }
        />
      </td>
      <td className="hidden px-6 py-3 xl:table-cell">
        <DashboardStatusPill
          label={getDashboardServiceAuthLabel(service)}
          className={getDashboardServiceAuthClassName(service)}
        />
      </td>
      <td className="hidden px-6 py-3 xl:table-cell">
        <DashboardStatusPill
          label={getDashboardRouterStatusLabel(routerActive)}
          className={getDashboardRouterStatusClassName(routerActive)}
        />
      </td>
    </tr>
  );
}
