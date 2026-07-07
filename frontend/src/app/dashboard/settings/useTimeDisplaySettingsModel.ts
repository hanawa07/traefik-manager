import { useState } from "react";

import {
  useTimeDisplaySettings,
  useUpdateTimeDisplaySettings,
} from "@/features/settings/hooks/useSettings";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
import { getDefaultDisplayTimezone } from "@/shared/lib/dateTimeFormat";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";

export function useTimeDisplaySettingsModel(canManage: boolean, onToast: (notice: ToastNoticeValue) => void) {
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(getDefaultDisplayTimezone());
  const [errorMessage, setErrorMessage] = useState("");
  const { data: settings, isLoading } = useTimeDisplaySettings();
  const updateTimeDisplay = useUpdateTimeDisplaySettings();

  const handleEdit = () => {
    setFormValue(settings?.display_timezone ?? getDefaultDisplayTimezone());
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await updateTimeDisplay.mutateAsync({ display_timezone: formValue.trim() });
      onToast({
        tone: "success",
        message: "시간 표시 설정 저장 완료",
        detail: `${formValue.trim()} 기준으로 화면 시간이 표시됩니다.`,
      });
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getSettingsModelErrorMessage(error, "표시 시간대 저장에 실패했습니다"));
    }
  };

  return {
    displayTimezone: settings?.display_timezone,
    card: {
      canManage,
      isLoading,
      isEditing,
      settings,
      formValue,
      errorMessage,
      isSaving: updateTimeDisplay.isPending,
      onEdit: handleEdit,
      onSave: handleSave,
      onCancel: () => setIsEditing(false),
      onFormValueChange: setFormValue,
    },
  };
}
