import { useState } from "react";

import {
  useLoginDefenseSettings,
  useUpdateLoginDefenseSettings,
} from "@/features/settings/hooks/useSettings";
import { createDefaultLoginDefenseForm } from "@/features/settings/lib/settingsDefaults";
import { parseMultivalueText } from "@/features/settings/lib/settingsFormHelpers";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";

export function useLoginDefenseSettingsModel(canManage: boolean) {
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(createDefaultLoginDefenseForm());
  const [errorMessage, setErrorMessage] = useState("");
  const { data: settings, isLoading } = useLoginDefenseSettings();
  const updateLoginDefense = useUpdateLoginDefenseSettings();

  const handleEdit = () => {
    setFormValue({
      suspicious_block_enabled: settings?.suspicious_block_enabled ?? true,
      suspicious_trusted_networks: settings?.suspicious_trusted_networks ?? [],
      suspicious_trusted_networks_text: (settings?.suspicious_trusted_networks ?? []).join("\n"),
      suspicious_block_escalation_enabled: settings?.suspicious_block_escalation_enabled ?? false,
      suspicious_block_escalation_window_minutes: settings?.suspicious_block_escalation_window_minutes ?? 1440,
      suspicious_block_escalation_multiplier: settings?.suspicious_block_escalation_multiplier ?? 2,
      suspicious_block_max_minutes: settings?.suspicious_block_max_minutes ?? 1440,
      turnstile_mode: settings?.turnstile_mode ?? "off",
      turnstile_site_key: settings?.turnstile_site_key ?? "",
      turnstile_secret_key: "",
    });
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await updateLoginDefense.mutateAsync({
        suspicious_block_enabled: formValue.suspicious_block_enabled,
        suspicious_trusted_networks: parseMultivalueText(formValue.suspicious_trusted_networks_text),
        suspicious_block_escalation_enabled: formValue.suspicious_block_escalation_enabled,
        suspicious_block_escalation_window_minutes: formValue.suspicious_block_escalation_window_minutes,
        suspicious_block_escalation_multiplier: formValue.suspicious_block_escalation_multiplier,
        suspicious_block_max_minutes: formValue.suspicious_block_max_minutes,
        turnstile_mode: formValue.turnstile_mode,
        turnstile_site_key: formValue.turnstile_site_key.trim(),
        turnstile_secret_key: formValue.turnstile_secret_key.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getSettingsModelErrorMessage(error, "로그인 방어 설정 저장에 실패했습니다"));
    }
  };

  return {
    canManage,
    isLoading,
    isEditing,
    settings,
    formValue,
    errorMessage,
    isSaving: updateLoginDefense.isPending,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
