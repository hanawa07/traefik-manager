import { Bug, Save, X } from "lucide-react";

import type {
  CertificateDiagnosticsSettingsInput,
  CertificateDiagnosticsSettingsStatus,
} from "@/features/settings/api/settingsApi";
import {
  SettingsActionRow,
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";

export function CertificateDiagnosticsSettingsCard({
  canManage,
  isLoading,
  isEditing,
  settings,
  formValue,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onFormChange,
}: {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  settings?: CertificateDiagnosticsSettingsStatus;
  formValue: CertificateDiagnosticsSettingsInput;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: (value: CertificateDiagnosticsSettingsInput) => void;
}) {
  return (
    <div className="card p-6 order-2">
      <SettingsCardHeader
        icon={<Bug className="w-5 h-5 text-violet-600" />}
        title="인증서 진단"
        description="사전 진단 자동 재검사 주기와 반복 실패 감지 기준을 조정합니다. 설정값은 수동 진단, 자동 재검사, 반복 실패 알림에 공통 적용됩니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ) : isEditing ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              label="자동 재검사 주기 (분)"
              min={5}
              max={1440}
              value={formValue.auto_check_interval_minutes}
              help="warning, error, pending 상태 인증서를 자동으로 다시 진단하는 간격입니다."
              onChange={(value) => onFormChange({ ...formValue, auto_check_interval_minutes: value })}
            />
            <NumberField
              label="반복 실패 감지 기준 (회)"
              min={2}
              max={20}
              value={formValue.repeat_alert_threshold}
              help="같은 실패 유형이 몇 번 연속 누적되면 반복 실패로 볼지 정합니다."
              onChange={(value) => onFormChange({ ...formValue, repeat_alert_threshold: value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              label="반복 실패 추적 창 (분)"
              min={5}
              max={10080}
              value={formValue.repeat_alert_window_minutes}
              help="이 시간 창 안에서 같은 실패 유형이 연속되면 streak를 유지합니다."
              onChange={(value) => onFormChange({ ...formValue, repeat_alert_window_minutes: value })}
            />
            <NumberField
              label="반복 실패 알림 쿨다운 (분)"
              min={5}
              max={10080}
              value={formValue.repeat_alert_cooldown_minutes}
              help="같은 실패가 반복돼도 이 시간 안에는 추가 알림을 억제합니다."
              onChange={(value) => onFormChange({ ...formValue, repeat_alert_cooldown_minutes: value })}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
            <p>적용 범위: 수동 사전 진단, 백그라운드 자동 재검사, 반복 실패 streak 계산, 반복 실패 알림</p>
            <p>권장값: 주기 60분 / 기준 3회 / 추적 창 240분 / 쿨다운 240분</p>
          </div>

          <SettingsActionRow>
            <button
              className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
              onClick={onSave}
              disabled={isSaving}
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "저장 중..." : "저장"}
            </button>
            <button className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs" onClick={onCancel}>
              <X className="w-3.5 h-3.5" /> 취소
            </button>
          </SettingsActionRow>
        </div>
      ) : (
        <SettingsSummary>
          <SettingsSummaryRow
            label="자동 재검사 주기"
            value={formatDurationMinutes(settings?.auto_check_interval_minutes ?? 60)}
          />
          <SettingsSummaryRow label="반복 실패 감지 기준" value={`${settings?.repeat_alert_threshold ?? 3}회`} />
          <SettingsSummaryRow
            label="반복 실패 추적 창"
            value={formatDurationMinutes(settings?.repeat_alert_window_minutes ?? 240)}
          />
          <SettingsSummaryRow
            label="반복 실패 알림 쿨다운"
            value={formatDurationMinutes(settings?.repeat_alert_cooldown_minutes ?? 240)}
          />
          <p className="text-xs text-gray-500 pt-1">
            인증서 발급 사전 진단 자동 재검사와 반복 실패 감지 기준을 공통으로 제어합니다.
          </p>
        </SettingsSummary>
      )}
    </div>
  );
}

function NumberField({
  label,
  min,
  max,
  value,
  help,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  help: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        className="input"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || min))}
      />
      <p className="mt-1 text-xs text-gray-500">{help}</p>
    </div>
  );
}
