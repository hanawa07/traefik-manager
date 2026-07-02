import type { CertificateDiagnosticsSettingsInput } from "@/features/settings/api/settingsApi";
import { CertificateDiagnosticsSettingsActions } from "./CertificateDiagnosticsSettingsActions";
import { CertificateDiagnosticsSettingsNumberField } from "./CertificateDiagnosticsSettingsNumberField";

interface CertificateDiagnosticsSettingsEditFormProps {
  formValue: CertificateDiagnosticsSettingsInput;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: (value: CertificateDiagnosticsSettingsInput) => void;
}

export function CertificateDiagnosticsSettingsEditForm({
  formValue,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: CertificateDiagnosticsSettingsEditFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <CertificateDiagnosticsSettingsNumberField
          label="자동 재검사 주기 (분)"
          min={5}
          max={1440}
          value={formValue.auto_check_interval_minutes}
          help="warning, error, pending 상태 인증서를 자동으로 다시 진단하는 간격입니다."
          onChange={(value) => onFormChange({ ...formValue, auto_check_interval_minutes: value })}
        />
        <CertificateDiagnosticsSettingsNumberField
          label="반복 실패 감지 기준 (회)"
          min={2}
          max={20}
          value={formValue.repeat_alert_threshold}
          help="같은 실패 유형이 몇 번 연속 누적되면 반복 실패로 볼지 정합니다."
          onChange={(value) => onFormChange({ ...formValue, repeat_alert_threshold: value })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CertificateDiagnosticsSettingsNumberField
          label="반복 실패 추적 창 (분)"
          min={5}
          max={10080}
          value={formValue.repeat_alert_window_minutes}
          help="이 시간 창 안에서 같은 실패 유형이 연속되면 streak를 유지합니다."
          onChange={(value) => onFormChange({ ...formValue, repeat_alert_window_minutes: value })}
        />
        <CertificateDiagnosticsSettingsNumberField
          label="반복 실패 알림 쿨다운 (분)"
          min={5}
          max={10080}
          value={formValue.repeat_alert_cooldown_minutes}
          help="같은 실패가 반복돼도 이 시간 안에는 추가 알림을 억제합니다."
          onChange={(value) => onFormChange({ ...formValue, repeat_alert_cooldown_minutes: value })}
        />
      </div>

      <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
        <p>적용 범위: 수동 사전 진단, 백그라운드 자동 재검사, 반복 실패 streak 계산, 반복 실패 알림</p>
        <p>권장값: 주기 60분 / 기준 3회 / 추적 창 240분 / 쿨다운 240분</p>
      </div>

      <CertificateDiagnosticsSettingsActions
        isSaving={isSaving}
        onCancel={onCancel}
        onSave={onSave}
      />
    </div>
  );
}
