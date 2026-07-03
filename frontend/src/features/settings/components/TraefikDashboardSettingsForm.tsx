import type { Dispatch, SetStateAction } from "react";

import type { TraefikDashboardSettingsInput } from "@/features/settings/api/settingsApi";

import { TraefikDashboardSettingsActions } from "./TraefikDashboardSettingsActions";
import { TraefikDashboardSettingsFields } from "./TraefikDashboardSettingsFields";
import { TraefikDashboardSettingsNotes } from "./TraefikDashboardSettingsNotes";

interface TraefikDashboardSettingsFormProps {
  formValue: TraefikDashboardSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  onFormChange: Dispatch<SetStateAction<TraefikDashboardSettingsInput>>;
  onSave: () => void;
  onCancel: () => void;
}

export function TraefikDashboardSettingsForm({
  formValue,
  errorMessage,
  isSaving,
  onFormChange,
  onSave,
  onCancel,
}: TraefikDashboardSettingsFormProps) {
  const updateForm = (patch: Partial<TraefikDashboardSettingsInput>) => {
    onFormChange((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="space-y-4">
      <TraefikDashboardSettingsFields formValue={formValue} onChange={updateForm} />
      <TraefikDashboardSettingsNotes />

      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

      <TraefikDashboardSettingsActions
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}
