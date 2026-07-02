import { Save, X } from "lucide-react";

import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";

interface SecurityAlertSettingsEditActionsProps {
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function SecurityAlertSettingsEditActions({
  isSaving,
  onCancel,
  onSave,
}: SecurityAlertSettingsEditActionsProps) {
  return (
    <SettingsActionRow>
      <button
        className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
        onClick={onSave}
        disabled={isSaving}
      >
        <Save className="h-3.5 w-3.5" />
        {isSaving ? "저장 중..." : "저장"}
      </button>
      <button className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs" onClick={onCancel}>
        <X className="h-3.5 w-3.5" /> 취소
      </button>
    </SettingsActionRow>
  );
}
