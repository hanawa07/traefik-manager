import { SecretField } from "@/features/settings/components/SecurityAlertProviderInputFields";
import type { SecurityAlertProviderFieldProps } from "@/features/settings/components/securityAlertProviderFieldTypes";

export function SecurityAlertPagerDutyFields({
  formValue,
  settings,
  updateForm,
}: SecurityAlertProviderFieldProps) {
  return (
    <SecretField
      label="Routing Key"
      placeholder="PXXXXXXXXXXXXXXX"
      value={formValue.pagerduty_routing_key}
      help={
        settings?.pagerduty_routing_key_configured
          ? "비워두면 기존 routing key를 유지합니다."
          : "PagerDuty Events API v2 integration key를 입력합니다."
      }
      onChange={(value) => updateForm({ pagerduty_routing_key: value })}
    />
  );
}
