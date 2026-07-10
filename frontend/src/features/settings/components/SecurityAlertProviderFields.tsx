import type {
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
} from "@/features/settings/api/settingsApi";
import { SecurityAlertEmailFields } from "@/features/settings/components/SecurityAlertEmailFields";
import { SecurityAlertPagerDutyFields } from "@/features/settings/components/SecurityAlertPagerDutyFields";
import { SecurityAlertTelegramFields } from "@/features/settings/components/SecurityAlertTelegramFields";
import { SecurityAlertWebhookFields } from "@/features/settings/components/SecurityAlertWebhookFields";
import type {
  SecurityAlertProvider,
  SecurityAlertProviderOption,
} from "@/features/settings/components/securityAlertProviderFieldTypes";
import { SECURITY_ALERT_PROVIDER_OPTIONS } from "@/features/settings/lib/settingsDefaults";

export function SecurityAlertProviderPicker({
  value,
  onChange,
}: {
  value: SecurityAlertProvider;
  onChange: (provider: SecurityAlertProvider) => void;
}) {
  return (
    <div>
      <label className="label">알림 채널</label>
      <div className="grid gap-2 md:grid-cols-2">
        {SECURITY_ALERT_PROVIDER_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`rounded-lg border p-3 text-sm cursor-pointer ${
              value === option.value
                ? "border-sky-500 bg-sky-50 text-sky-900 dark:border-sky-500 dark:bg-sky-500/10 dark:text-sky-100"
                : "border-gray-200 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name="security-alert-provider"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="block font-medium">{option.label}</span>
            <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">{option.description}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function SecurityAlertProviderFields({
  formValue,
  settings,
  selectedProvider,
  updateForm,
}: {
  formValue: SecurityAlertSettingsInput;
  settings?: SecurityAlertSettingsStatus;
  selectedProvider: SecurityAlertProviderOption;
  updateForm: (patch: Partial<SecurityAlertSettingsInput>) => void;
}) {
  if (formValue.provider === "telegram") {
    return <SecurityAlertTelegramFields formValue={formValue} settings={settings} updateForm={updateForm} />;
  }

  if (formValue.provider === "email") {
    return <SecurityAlertEmailFields formValue={formValue} settings={settings} updateForm={updateForm} />;
  }

  if (formValue.provider === "pagerduty") {
    return (
      <SecurityAlertPagerDutyFields formValue={formValue} settings={settings} updateForm={updateForm} />
    );
  }

  return (
    <SecurityAlertWebhookFields
      formValue={formValue}
      settings={settings}
      selectedProvider={selectedProvider}
      updateForm={updateForm}
    />
  );
}
