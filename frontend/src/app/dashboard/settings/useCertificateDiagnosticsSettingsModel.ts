import { useState } from "react";

import {
  useCertificateDiagnosticsSettings,
  useUpdateCertificateDiagnosticsSettings,
} from "@/features/settings/hooks/useSettings";
import { createDefaultCertificateDiagnosticsForm } from "@/features/settings/lib/settingsDefaults";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";

export function useCertificateDiagnosticsSettingsModel(canManage: boolean, onToast: (notice: ToastNoticeValue) => void) {
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(createDefaultCertificateDiagnosticsForm());
  const [errorMessage, setErrorMessage] = useState("");
  const { data: settings, isLoading } = useCertificateDiagnosticsSettings();
  const updateCertificateDiagnostics = useUpdateCertificateDiagnosticsSettings();

  const handleEdit = () => {
    setFormValue({
      auto_check_interval_minutes: settings?.auto_check_interval_minutes ?? 60,
      repeat_alert_threshold: settings?.repeat_alert_threshold ?? 3,
      repeat_alert_window_minutes: settings?.repeat_alert_window_minutes ?? 240,
      repeat_alert_cooldown_minutes: settings?.repeat_alert_cooldown_minutes ?? 240,
    });
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await updateCertificateDiagnostics.mutateAsync(formValue);
      onToast({
        tone: "success",
        message: "인증서 진단 설정 저장 완료",
        detail: `자동 재검사 주기 ${formValue.auto_check_interval_minutes}분, 반복 실패 ${formValue.repeat_alert_threshold}회 기준입니다.`,
      });
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getSettingsModelErrorMessage(error, "인증서 진단 설정 저장에 실패했습니다"));
    }
  };

  return {
    canManage,
    isLoading,
    isEditing,
    settings,
    formValue,
    errorMessage,
    isSaving: updateCertificateDiagnostics.isPending,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
