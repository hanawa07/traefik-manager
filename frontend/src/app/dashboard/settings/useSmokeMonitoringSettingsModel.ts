import { useState } from "react";

import type { SmokeMonitoringSettingsInput } from "@/features/settings/api/settingsApi";
import {
  useSmokeRotationStatus,
  useUpdateSmokeMonitoringSettings,
} from "@/features/settings/hooks/useSettings";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";

const DEFAULT_FORM: SmokeMonitoringSettingsInput = {
  monitoring_enabled: true,
  monitoring_frequency: "daily",
};

export function useSmokeMonitoringSettingsModel(
  canManage: boolean,
  timezone: string | undefined,
  onToast: (notice: ToastNoticeValue) => void,
) {
  const query = useSmokeRotationStatus();
  const update = useUpdateSmokeMonitoringSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(DEFAULT_FORM);
  const [errorMessage, setErrorMessage] = useState("");

  const handleEdit = () => {
    setFormValue({
      monitoring_enabled: query.data?.monitoring_enabled ?? true,
      monitoring_frequency: query.data?.monitoring_frequency ?? "daily",
    });
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await update.mutateAsync(formValue);
      onToast({
        tone: "success",
        message: "운영 로그인·화면 점검 설정 저장 완료",
        detail: formValue.monitoring_enabled
          ? `${formValue.monitoring_frequency === "daily" ? "매일" : "매주 일요일"} 예약 점검을 실행합니다.`
          : "예약 자동 점검을 중지했습니다. 수동 점검은 계속 실행할 수 있습니다.",
      });
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getSettingsModelErrorMessage(error, "운영 점검 설정 저장에 실패했습니다"));
    }
  };

  return {
    canManage,
    isLoading: query.isLoading,
    isError: query.isError,
    isEditing,
    status: query.data,
    timezone,
    formValue,
    errorMessage,
    isSaving: update.isPending,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
