"use client";

import type { ServiceCreate } from "../api/serviceApi";
import ServiceContainerImportModal from "./ServiceContainerImportModal";
import ServiceFormFields from "./ServiceFormFields";
import type { ServiceFormDefaultValues } from "./serviceFormSchema";
import { useServiceFormModel } from "./useServiceFormModel";

interface ServiceFormProps {
  defaultValues?: ServiceFormDefaultValues;
  onSubmit: (data: ServiceCreate) => void;
  loading?: boolean;
  submitLabel?: string;
}

export default function ServiceForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "저장",
}: ServiceFormProps) {
  const { formFields, containerImportModal } = useServiceFormModel({ defaultValues, onSubmit });

  return (
    <>
      <ServiceFormFields {...formFields} loading={loading} submitLabel={submitLabel} />
      <ServiceContainerImportModal {...containerImportModal} />
    </>
  );
}
