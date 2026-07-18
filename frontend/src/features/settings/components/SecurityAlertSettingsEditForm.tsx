import type { Dispatch, SetStateAction } from "react";

import type {
  ChangeAlertRouteEvent,
  SecurityAlertRouteEvent,
  SecurityAlertRouteTarget,
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
} from "@/features/settings/api/settingsApi";
import { ManagerHealthMonitoringFields } from "@/features/settings/components/ManagerHealthMonitoringFields";
import { ManagerHttpErrorMonitoringFields } from "@/features/settings/components/ManagerHttpErrorMonitoringFields";
import { SecurityAlertEnablementFields } from "@/features/settings/components/SecurityAlertEnablementFields";
import {
  SecurityAlertProviderFields,
  SecurityAlertProviderPicker,
} from "@/features/settings/components/SecurityAlertProviderFields";
import { SecurityAlertRouteSections } from "@/features/settings/components/SecurityAlertRouteSections";
import { SecurityAlertRetryDelayField } from "@/features/settings/components/SecurityAlertRetryDelayField";
import { SecurityAlertSettingsEditActions } from "@/features/settings/components/SecurityAlertSettingsEditActions";
import { SecurityAlertSettingsInfoNotice } from "@/features/settings/components/SecurityAlertSettingsInfoNotice";
import { SECURITY_ALERT_PROVIDER_OPTIONS } from "@/features/settings/lib/settingsDefaults";

interface SecurityAlertSettingsEditFormProps {
  settings?: SecurityAlertSettingsStatus;
  formValue: SecurityAlertSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: Dispatch<SetStateAction<SecurityAlertSettingsInput>>;
}

export function SecurityAlertSettingsEditForm({
  settings,
  formValue,
  errorMessage,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: SecurityAlertSettingsEditFormProps) {
  const selectedProvider =
    SECURITY_ALERT_PROVIDER_OPTIONS.find((option) => option.value === formValue.provider) ??
    SECURITY_ALERT_PROVIDER_OPTIONS[0];
  const updateForm = (patch: Partial<SecurityAlertSettingsInput>) => {
    onFormChange((current) => ({ ...current, ...patch }));
  };
  const setSecurityRoute = (key: SecurityAlertRouteEvent, route: SecurityAlertRouteTarget) => {
    onFormChange((current) => ({
      ...current,
      event_routes: { ...current.event_routes, [key]: route },
    }));
  };
  const setChangeRoute = (key: ChangeAlertRouteEvent, route: SecurityAlertRouteTarget) => {
    onFormChange((current) => ({
      ...current,
      change_event_routes: { ...current.change_event_routes, [key]: route },
    }));
  };

  return (
    <div className="space-y-4">
      <SecurityAlertEnablementFields formValue={formValue} updateForm={updateForm} />
      <ManagerHealthMonitoringFields formValue={formValue} updateForm={updateForm} />
      <ManagerHttpErrorMonitoringFields formValue={formValue} updateForm={updateForm} />
      <SecurityAlertRetryDelayField
        value={formValue.automatic_retry_delay_warning_minutes}
        onChange={updateForm}
      />

      <SecurityAlertProviderPicker value={formValue.provider} onChange={(provider) => updateForm({ provider })} />
      <SecurityAlertProviderFields
        formValue={formValue}
        settings={settings}
        selectedProvider={selectedProvider}
        updateForm={updateForm}
      />

      <SecurityAlertRouteSections
        formValue={formValue}
        providerLabel={selectedProvider.label}
        setChangeRoute={setChangeRoute}
        setSecurityRoute={setSecurityRoute}
      />

      <SecurityAlertSettingsInfoNotice settings={settings} />
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

      <SecurityAlertSettingsEditActions isSaving={isSaving} onCancel={onCancel} onSave={onSave} />
    </div>
  );
}
