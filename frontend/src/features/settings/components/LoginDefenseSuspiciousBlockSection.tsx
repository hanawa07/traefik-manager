import type { LoginDefenseSettingsStatus } from "@/features/settings/api/settingsApi";
import { LoginDefenseCheckboxRow } from "@/features/settings/components/LoginDefenseCheckboxRow";
import { LoginDefenseEscalationFields } from "@/features/settings/components/LoginDefenseEscalationFields";
import type { LoginDefenseUpdateForm } from "@/features/settings/components/LoginDefenseFormTypes";
import { LoginDefenseTrustedNetworksField } from "@/features/settings/components/LoginDefenseTrustedNetworksField";
import type { LoginDefenseForm } from "@/features/settings/lib/settingsDefaults";

export function LoginDefenseSuspiciousBlockSection({
  settings,
  formValue,
  updateForm,
}: {
  settings?: LoginDefenseSettingsStatus;
  formValue: LoginDefenseForm;
  updateForm: LoginDefenseUpdateForm;
}) {
  return (
    <>
      <LoginDefenseCheckboxRow
        checked={formValue.suspicious_block_enabled}
        accentClassName="accent-amber-600"
        title="이상 징후 IP 자동 차단 활성화"
        description="`login_suspicious`가 기록된 IP는 일정 시간 로그인 단계에서 바로 차단합니다."
        onChange={(checked) => updateForm({ suspicious_block_enabled: checked })}
      />

      <LoginDefenseTrustedNetworksField formValue={formValue} updateForm={updateForm} />

      <LoginDefenseCheckboxRow
        checked={formValue.suspicious_block_escalation_enabled}
        accentClassName="accent-amber-600"
        title="반복 차단 시간 자동 상승"
        description="같은 IP가 반복해서 다시 차단되면 차단 시간을 자동으로 늘립니다."
        onChange={(checked) => updateForm({ suspicious_block_escalation_enabled: checked })}
      />

      <LoginDefenseEscalationFields
        settings={settings}
        formValue={formValue}
        updateForm={updateForm}
      />
    </>
  );
}
