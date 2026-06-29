import { useState } from "react";

import {
  useCertificateDiagnosticsSettings,
  useUpdateCertificateDiagnosticsSettings,
} from "@/features/settings/hooks/useSettings";
import { createDefaultCertificateDiagnosticsForm } from "@/features/settings/lib/settingsDefaults";

export function useCertificateDiagnosticsSettingsModel(canManage: boolean) {
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(createDefaultCertificateDiagnosticsForm());
  const { data: settings, isLoading } = useCertificateDiagnosticsSettings();
  const updateCertificateDiagnostics = useUpdateCertificateDiagnosticsSettings();

  const handleEdit = () => {
    setFormValue({
      auto_check_interval_minutes: settings?.auto_check_interval_minutes ?? 60,
      repeat_alert_threshold: settings?.repeat_alert_threshold ?? 3,
      repeat_alert_window_minutes: settings?.repeat_alert_window_minutes ?? 240,
      repeat_alert_cooldown_minutes: settings?.repeat_alert_cooldown_minutes ?? 240,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateCertificateDiagnostics.mutateAsync(formValue);
    setIsEditing(false);
  };

  return {
    canManage,
    isLoading,
    isEditing,
    settings,
    formValue,
    isSaving: updateCertificateDiagnostics.isPending,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
