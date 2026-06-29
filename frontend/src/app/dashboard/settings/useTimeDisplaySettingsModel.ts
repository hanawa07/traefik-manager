import { useState } from "react";

import {
  useTimeDisplaySettings,
  useUpdateTimeDisplaySettings,
} from "@/features/settings/hooks/useSettings";
import { getDefaultDisplayTimezone } from "@/shared/lib/dateTimeFormat";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";

export function useTimeDisplaySettingsModel(canManage: boolean) {
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
