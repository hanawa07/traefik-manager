import { useState } from "react";

import type { SmokeMonitoringSettingsInput } from "@/features/settings/api/settingsApi";
import {
  useRefreshSmokeMonitoringHistory,
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
  const refreshHistory = useRefreshSmokeMonitoringHistory();
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

  const handleRefreshHistory = async () => {
    try {
      const refreshed = await refreshHistory.mutateAsync();
      if (refreshed.monitoring_history_error) {
        onToast({
          tone: "warning",
          message: "원격 실행 이력을 갱신하지 못했습니다",
          detail: refreshed.monitoring_history_error,
        });
        return;
      }
      onToast({
        tone: "success",
        message: "원격 실행 이력 새로고침 완료",
        detail: `최근 실행 ${refreshed.monitoring_recent_runs.length}건을 확인했습니다.`,
      });
    } catch (error) {
      onToast({
        tone: "error",
        message: "원격 실행 이력 새로고침 실패",
        detail: getSettingsModelErrorMessage(error, "GitHub 실행 이력을 확인하지 못했습니다"),
      });
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
    isRefreshingHistory: refreshHistory.isPending,
    onEdit: handleEdit,
    onSave: handleSave,
    onRefreshHistory: handleRefreshHistory,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
