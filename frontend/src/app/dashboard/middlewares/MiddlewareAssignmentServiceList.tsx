import { clsx } from "clsx";

import type { Service } from "@/features/services/api/serviceApi";

import { Checkmark } from "./middlewarePageHelpers";

interface MiddlewareAssignmentServiceListProps {
  filteredServices: Service[];
  selectedServiceIds: string[];
  onToggleService: (serviceId: string) => void;
}

export function MiddlewareAssignmentServiceList({
  filteredServices,
  selectedServiceIds,
  onToggleService,
}: MiddlewareAssignmentServiceListProps) {
  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-2">
      {filteredServices.map((service) => {
        const checked = selectedServiceIds.includes(service.id);
        return (
          <label
            key={service.id}
            className={clsx(
              "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors",
              checked
                ? "border-blue-200 bg-blue-50"
                : "border-transparent bg-white hover:border-gray-200 hover:bg-gray-50",
            )}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-blue-600"
                checked={checked}
                onChange={() => onToggleService(service.id)}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{service.name}</p>
                <p className="text-xs text-gray-500">{service.domain}</p>
              </div>
            </div>
            {checked ? <Checkmark /> : null}
          </label>
        );
      })}

      {filteredServices.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          검색 조건에 맞는 서비스가 없습니다.
        </div>
      ) : null}
    </div>
  );
}
