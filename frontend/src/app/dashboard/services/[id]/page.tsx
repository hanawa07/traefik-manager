"use client";
import { useParams, useRouter } from "next/navigation";
import { useService, useUpdateService } from "@/features/services/hooks/useServices";
import { ServiceUpdate } from "@/features/services/api/serviceApi";
import { useAuthStore } from "@/features/auth/store/useAuthStore";
import { EditServiceFormCard } from "./EditServiceFormCard";
import { EditServicePageHeader } from "./EditServicePageHeader";
import {
  EditServiceLoadingState,
  EditServiceNotFoundState,
  EditServiceReadOnlyState,
} from "./EditServicePageStates";

export default function EditServicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const { data: service, isLoading } = useService(id);
  const updateService = useUpdateService(id);

  const handleSubmit = async (data: ServiceUpdate) => {
    await updateService.mutateAsync(data);
    router.push("/dashboard/services");
  };

  if (isLoading) {
    return <EditServiceLoadingState />;
  }

  if (!service) {
    return <EditServiceNotFoundState />;
  }

  if (role === "viewer") {
    return <EditServiceReadOnlyState />;
  }

  return (
    <div className="p-8 max-w-2xl">
      <EditServicePageHeader domain={service.domain} />
      <EditServiceFormCard
        service={service}
        error={updateService.error}
        isPending={updateService.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
