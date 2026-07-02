import type { SecurityAlertSettingsInput } from "@/features/settings/api/settingsApi";

interface SecurityAlertEnablementFieldsProps {
  formValue: SecurityAlertSettingsInput;
  updateForm: (patch: Partial<SecurityAlertSettingsInput>) => void;
}

export function SecurityAlertEnablementFields({
  formValue,
  updateForm,
}: SecurityAlertEnablementFieldsProps) {
  return (
    <>
      <SecurityAlertCheckboxRow
        checked={formValue.enabled}
        title="보안 웹훅 알림 활성화"
        description="보안 경고 이벤트가 발생하면 JSON payload를 webhook endpoint로 전송합니다."
        onChange={(checked) => updateForm({ enabled: checked })}
      />
      <SecurityAlertCheckboxRow
        checked={formValue.change_alerts_enabled}
        title="운영 변경 알림 활성화"
        description="설정, 서비스, 리다이렉트, 미들웨어, 사용자 변경과 롤백 이벤트를 같은 채널 정책으로 전달합니다."
        onChange={(checked) => updateForm({ change_alerts_enabled: checked })}
      />
    </>
  );
}

function SecurityAlertCheckboxRow({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 " +
        "text-sm text-gray-700"
      }
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded accent-sky-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-medium text-gray-900">{title}</span>
        <span className="mt-1 block text-xs text-gray-500">{description}</span>
      </span>
    </label>
  );
}
