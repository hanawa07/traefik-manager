"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

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
import { runServiceSaveDiagnosis, storeServiceSaveDiagnosisNotice } from "../serviceSaveDiagnosis";

export default function EditServicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const { data: service, isLoading } = useService(id);
  const updateService = useUpdateService(id);
  const [isDiagnosingAfterSave, setIsDiagnosingAfterSave] = useState(false);

  const handleSubmit = async (data: ServiceUpdate) => {
    const updatedService = await updateService.mutateAsync(data);
    setIsDiagnosingAfterSave(true);
    const notice = await runServiceSaveDiagnosis(updatedService, "updated");
    storeServiceSaveDiagnosisNotice(notice);
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
    <div className="w-full max-w-7xl">
      <EditServicePageHeader domain={service.domain} />
      <EditServiceFormCard
        service={service}
        error={updateService.error}
        isPending={updateService.isPending || isDiagnosingAfterSave}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
