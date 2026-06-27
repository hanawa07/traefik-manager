import { Clock3, Save, X } from "lucide-react";

import type { TimeDisplaySettingsStatus } from "@/features/settings/api/settingsApi";
import {
  SettingsActionRow,
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { getSupportedTimeZones } from "@/shared/lib/dateTimeFormat";

export function TimeDisplaySettingsCard({
  canManage,
  isLoading,
  isEditing,
  settings,
  formValue,
  errorMessage,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onFormValueChange,
}: {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  settings?: TimeDisplaySettingsStatus;
  formValue: string;
  errorMessage: string;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormValueChange: (value: string) => void;
}) {
  const supportedTimeZones = getSupportedTimeZones();

  return (
    <div className="card p-6 order-1">
      <SettingsCardHeader
        icon={<Clock3 className="w-5 h-5 text-emerald-600" />}
        title="시간 표시 설정"
        description="저장/토큰/감사로그 원본 시각은 UTC로 유지하고, 화면 표시만 선택한 IANA 타임존으로 변환합니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ) : isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="label">표시 시간대 (IANA)</label>
            <input
              list="supported-timezones"
              className="input"
              placeholder="예: Asia/Seoul, UTC, America/New_York"
              value={formValue}
              onChange={(event) => onFormValueChange(event.target.value)}
            />
            <datalist id="supported-timezones">
              {supportedTimeZones.map((timeZone) => (
                <option key={timeZone} value={timeZone} />
              ))}
            </datalist>
            <p className="text-xs text-gray-400 mt-1">
              검색 가능한 전체 IANA 타임존 목록을 지원합니다. 예: `Asia/Seoul`, `UTC`, `Europe/Berlin`,
              `America/New_York`
            </p>
          </div>

          <TimeDisplayRuntimeSummary settings={settings} />

          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}

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
          <SettingsSummaryRow label="현재 표시 시간대" value={settings?.display_timezone || "(미설정)"} mono />
          <SettingsSummaryRow label="저장 기준" value={`${settings?.storage_timezone} (고정)`} mono />
          <SettingsSummaryRow
            label="서버 시간대"
            value={`${settings?.server_timezone_label} (${settings?.server_timezone_offset})`}
            mono
          />
          <p className="text-xs text-gray-500 pt-1">
            저장 데이터와 토큰 시각은 항상 UTC로 유지됩니다. 서버 시간대는 현재 컨테이너의 로컬 시간대로,
            `docker compose`의 `TZ` 설정에 따라 달라질 수 있습니다.
          </p>
        </SettingsSummary>
      )}
    </div>
  );
}

function TimeDisplayRuntimeSummary({ settings }: { settings?: TimeDisplaySettingsStatus }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">저장 기준</span>
        <span className="font-mono text-gray-700">{settings?.storage_timezone} (고정)</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">서버 시간대</span>
        <span className="font-mono text-gray-700">
          {settings?.server_timezone_label} ({settings?.server_timezone_offset})
        </span>
      </div>
      <p className="text-xs text-gray-500 pt-1">
        저장 데이터와 토큰 시각은 항상 UTC로 유지됩니다. 서버 시간대는 현재 컨테이너의 로컬 시간대로, `docker
        compose`의 `TZ` 설정에 따라 달라질 수 있습니다.
      </p>
    </div>
  );
}
