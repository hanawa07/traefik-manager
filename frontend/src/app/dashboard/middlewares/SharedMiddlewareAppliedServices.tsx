import Link from "next/link";
import { Server } from "lucide-react";

import type { Service } from "@/features/services/api/serviceApi";

interface SharedMiddlewareAppliedServicesProps {
  services: Service[];
}

export function SharedMiddlewareAppliedServices({
  services,
}: SharedMiddlewareAppliedServicesProps) {
  return (
    <div className="mt-4 border-t border-gray-100 pt-4 dark:border-slate-700">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
        <Server className="h-3.5 w-3.5" />
        적용 서비스
      </div>
      {services.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
          아직 적용된 서비스가 없습니다. `서비스에 적용`에서 여러 앱에 바로 붙일 수 있습니다.
        </p>
      ) : (
        <AppliedServiceLinks services={services} />
      )}
    </div>
  );
}

function AppliedServiceLinks({ services }: { services: Service[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {services.map((service) => (
        <Link
          key={service.id}
          href={`/dashboard/services/${service.id}`}
          className={
            "rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 " +
            "transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 " +
            "dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
          }
        >
          <span className="font-medium">{service.name}</span>
          <span className="ml-2 text-xs text-gray-500 dark:text-slate-500">{service.domain}</span>
        </Link>
      ))}
    </div>
  );
}
