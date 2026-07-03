import ServiceForm from "@/features/services/components/ServiceForm";
import type { Service, ServiceUpdate } from "@/features/services/api/serviceApi";

import { getServiceEditErrorMessage, serviceToFormDefaultValues } from "./editServicePageHelpers";

interface EditServiceFormCardProps {
  service: Service;
  error: unknown;
  isPending: boolean;
  onSubmit: (data: ServiceUpdate) => void;
}

export function EditServiceFormCard({
  service,
  error,
  isPending,
  onSubmit,
}: EditServiceFormCardProps) {
  return (
    <div className="card p-4 sm:p-6 lg:p-8">
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
          <p className="text-red-600 text-sm">{getServiceEditErrorMessage(error)}</p>
        </div>
      ) : null}
      <ServiceForm
        defaultValues={serviceToFormDefaultValues(service)}
        onSubmit={onSubmit}
        loading={isPending}
        submitLabel="수정 완료"
      />
    </div>
  );
}
