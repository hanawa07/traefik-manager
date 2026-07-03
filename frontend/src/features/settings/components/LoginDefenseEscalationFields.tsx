import type { LoginDefenseSettingsStatus } from "@/features/settings/api/settingsApi";
import type { LoginDefenseUpdateForm } from "@/features/settings/components/LoginDefenseFormTypes";
import type { LoginDefenseForm } from "@/features/settings/lib/settingsDefaults";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";

interface LoginDefenseEscalationFieldsProps {
  settings?: LoginDefenseSettingsStatus;
  formValue: LoginDefenseForm;
  updateForm: LoginDefenseUpdateForm;
}

export function LoginDefenseEscalationFields({
  settings,
  formValue,
  updateForm,
}: LoginDefenseEscalationFieldsProps) {
  return (
    <>
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
