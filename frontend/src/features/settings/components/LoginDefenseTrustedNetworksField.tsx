import type { LoginDefenseUpdateForm } from "@/features/settings/components/LoginDefenseFormTypes";
import type { LoginDefenseForm } from "@/features/settings/lib/settingsDefaults";

interface LoginDefenseTrustedNetworksFieldProps {
  formValue: LoginDefenseForm;
  updateForm: LoginDefenseUpdateForm;
}

export function LoginDefenseTrustedNetworksField({
  formValue,
  updateForm,
}: LoginDefenseTrustedNetworksFieldProps) {
  return (
    <div>
      <label className="label">신뢰 네트워크 예외 (CIDR / IP)</label>
      <textarea
        className="input min-h-28 py-3 font-mono text-sm"
        placeholder={"예:\n10.0.0.0/8\n192.168.0.0/16\n203.0.113.10"}
        value={formValue.suspicious_trusted_networks_text}
        onChange={(event) => updateForm({ suspicious_trusted_networks_text: event.target.value })}
      />
      <p className="mt-1 text-xs text-gray-500">
        줄바꿈 또는 쉼표로 구분합니다. 여기에 포함된 IP는 이상 징후 기록과 자동 차단에서 제외됩니다.
        사용자별 계정 잠금은 그대로 적용됩니다.
      </p>
    </div>
  );
}
