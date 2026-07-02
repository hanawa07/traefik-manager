import { Save, X } from "lucide-react";

import type { UpstreamSecuritySettingsStatus } from "@/features/settings/api/settingsApi";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";
import type { UpstreamSecurityForm } from "@/features/settings/lib/settingsDefaults";
import { UpstreamSecurityAllowlistSection } from "./UpstreamSecurityAllowlistSection";
import { UpstreamSecurityPresetSection } from "./UpstreamSecurityPresetSection";
import { UpstreamSecurityToggleOptionsSection } from "./UpstreamSecurityToggleOptionsSection";

interface UpstreamSecuritySettingsEditFormProps {
  settings?: UpstreamSecuritySettingsStatus;
  formValue: UpstreamSecurityForm;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: (value: UpstreamSecurityForm) => void;
}

export function UpstreamSecuritySettingsEditForm({
  settings,
  formValue,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: UpstreamSecuritySettingsEditFormProps) {
  const presets = settings?.available_presets ?? [];

  return (
    <div className="space-y-4">
      <UpstreamSecurityPresetSection
        formValue={formValue}
        presets={presets}
        onFormChange={onFormChange}
      />
      <UpstreamSecurityAllowlistSection formValue={formValue} onFormChange={onFormChange} />
      <UpstreamSecurityToggleOptionsSection formValue={formValue} onFormChange={onFormChange} />

      <SettingsActionRow>
        <button
          type="button"
          className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
          onClick={onSave}
          disabled={isSaving}
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
          onClick={onCancel}
        >
          <X className="w-3.5 h-3.5" /> 취소
        </button>
      </SettingsActionRow>
    </div>
  );
}
