import type { Dispatch, SetStateAction } from "react";
import { Save, X } from "lucide-react";

import type { LoginDefenseSettingsStatus } from "@/features/settings/api/settingsApi";
import { LoginDefensePolicySummary } from "@/features/settings/components/LoginDefensePolicySummary";
import { LoginDefenseSuspiciousBlockSection } from "@/features/settings/components/LoginDefenseSuspiciousBlockSection";
import { LoginDefenseTurnstileSection } from "@/features/settings/components/LoginDefenseTurnstileSection";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";
import type { LoginDefenseForm } from "@/features/settings/lib/settingsDefaults";

interface LoginDefenseSettingsEditFormProps {
  settings?: LoginDefenseSettingsStatus;
  formValue: LoginDefenseForm;
  errorMessage: string;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: Dispatch<SetStateAction<LoginDefenseForm>>;
}

export function LoginDefenseSettingsEditForm({
  settings,
  formValue,
  errorMessage,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: LoginDefenseSettingsEditFormProps) {
  const updateForm = (patch: Partial<LoginDefenseForm>) => {
    onFormChange((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="space-y-4">
      <LoginDefensePolicySummary settings={settings} />

      <LoginDefenseSuspiciousBlockSection settings={settings} formValue={formValue} updateForm={updateForm} />
      <LoginDefenseTurnstileSection settings={settings} formValue={formValue} updateForm={updateForm} />

      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

      <SettingsActionRow>
        <button className="btn-primary flex items-center gap-1.5 py-1.5 text-xs" onClick={onSave} disabled={isSaving}>
          <Save className="w-3.5 h-3.5" />
          {isSaving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs" onClick={onCancel}>
          <X className="w-3.5 h-3.5" /> 취소
        </button>
      </SettingsActionRow>
    </div>
  );
}
