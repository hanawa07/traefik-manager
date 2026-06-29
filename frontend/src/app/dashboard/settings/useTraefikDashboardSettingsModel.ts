import { useState } from "react";

import {
  useTraefikDashboardSettings,
  useUpdateTraefikDashboardSettings,
} from "@/features/settings/hooks/useSettings";
import { createDefaultTraefikDashboardForm } from "@/features/settings/lib/settingsDefaults";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";

export function useTraefikDashboardSettingsModel(canManage: boolean) {
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(createDefaultTraefikDashboardForm());
  const [errorMessage, setErrorMessage] = useState("");
  const { data: settings, isLoading } = useTraefikDashboardSettings();
  const updateTraefikDashboard = useUpdateTraefikDashboardSettings();

  const handleEdit = () => {
    setFormValue({
      enabled: settings?.enabled ?? false,
      domain: settings?.domain ?? "",
      auth_username: settings?.auth_username ?? "",
      auth_password: "",
    });
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await updateTraefikDashboard.mutateAsync({
        enabled: formValue.enabled,
        domain: formValue.domain.trim(),
        auth_username: formValue.auth_username.trim(),
        auth_password: formValue.auth_password,
      });
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getSettingsModelErrorMessage(error, "Traefik 디버그 대시보드 설정 저장에 실패했습니다"));
    }
  };

  return {
    canManage,
    isLoading,
    isEditing,
    settings,
    formValue,
    errorMessage,
    isSaving: updateTraefikDashboard.isPending,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
