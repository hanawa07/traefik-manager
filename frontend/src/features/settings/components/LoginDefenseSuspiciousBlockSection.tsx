import type { LoginDefenseSettingsStatus } from "@/features/settings/api/settingsApi";
import { LoginDefenseCheckboxRow } from "@/features/settings/components/LoginDefenseCheckboxRow";
import type { LoginDefenseUpdateForm } from "@/features/settings/components/LoginDefenseFormTypes";
import type { LoginDefenseForm } from "@/features/settings/lib/settingsDefaults";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";

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

      <LoginDefenseCheckboxRow
        checked={formValue.suspicious_block_escalation_enabled}
        accentClassName="accent-amber-600"
        title="반복 차단 시간 자동 상승"
        description="같은 IP가 반복해서 다시 차단되면 차단 시간을 자동으로 늘립니다."
        onChange={(checked) => updateForm({ suspicious_block_escalation_enabled: checked })}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">상승 계산 창 (분)</label>
          <input
            type="number"
            min={1}
            className="input"
            value={formValue.suspicious_block_escalation_window_minutes}
            onChange={(event) =>
              updateForm({
                suspicious_block_escalation_window_minutes: Number(event.target.value || 1),
              })
            }
          />
        </div>
        <div>
          <label className="label">반복 배수</label>
          <input
            type="number"
            min={2}
            className="input"
            value={formValue.suspicious_block_escalation_multiplier}
            onChange={(event) =>
              updateForm({
                suspicious_block_escalation_multiplier: Number(event.target.value || 2),
              })
            }
          />
        </div>
        <div>
          <label className="label">최대 차단 시간 (분)</label>
          <input
            type="number"
            min={settings?.suspicious_block_minutes ?? 30}
            className="input"
            value={formValue.suspicious_block_max_minutes}
            onChange={(event) =>
              updateForm({
                suspicious_block_max_minutes: Number(event.target.value || (settings?.suspicious_block_minutes ?? 30)),
              })
            }
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        기본 차단 시간은 {formatDurationMinutes(settings?.suspicious_block_minutes ?? 30)}이며, 반복 차단 시
        배수만큼 늘어나되 최대 시간에서 멈춥니다.
      </p>
    </>
  );
}
