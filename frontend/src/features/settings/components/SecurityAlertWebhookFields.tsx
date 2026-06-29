import { TextField } from "@/features/settings/components/SecurityAlertProviderInputFields";
import type {
  SecurityAlertProviderFieldProps,
  SecurityAlertProviderOption,
} from "@/features/settings/components/securityAlertProviderFieldTypes";

type SecurityAlertWebhookFieldsProps = SecurityAlertProviderFieldProps & {
  selectedProvider: SecurityAlertProviderOption;
};

export function SecurityAlertWebhookFields({
  formValue,
  selectedProvider,
  updateForm,
}: SecurityAlertWebhookFieldsProps) {
  return (
    <TextField
      label="Webhook URL"
      type="url"
      placeholder={selectedProvider.placeholder}
      value={formValue.webhook_url}
      help={selectedProvider.description}
      onChange={(value) => updateForm({ webhook_url: value })}
    />
  );
}
