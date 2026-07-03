import { Save, X } from "lucide-react";

import type { TimeDisplaySettingsStatus } from "@/features/settings/api/settingsApi";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";
import { getSupportedTimeZones } from "@/shared/lib/dateTimeFormat";

import { TimeDisplayRuntimeSummary } from "./TimeDisplayRuntimeSummary";

interface TimeDisplaySettingsEditFormProps {
  errorMessage: string;
  formValue: string;
  isSaving: boolean;
  onCancel: () => void;
  onFormValueChange: (value: string) => void;
  onSave: () => void;
  settings?: TimeDisplaySettingsStatus;
}

export function TimeDisplaySettingsEditForm({
  errorMessage,
  formValue,
  isSaving,
  onCancel,
  onFormValueChange,
  onSave,
  settings,
}: TimeDisplaySettingsEditFormProps) {
  const supportedTimeZones = getSupportedTimeZones();

  return (
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
        <p className="mt-1 text-xs text-gray-400">
          검색 가능한 전체 IANA 타임존 목록을 지원합니다. 예: `Asia/Seoul`, `UTC`, `Europe/Berlin`,
          `America/New_York`
        </p>
      </div>

      <TimeDisplayRuntimeSummary settings={settings} />

      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

      <SettingsActionRow>
        <button
          className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
          onClick={onSave}
          disabled={isSaving}
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "저장 중..." : "저장"}
        </button>
        <button className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> 취소
        </button>
      </SettingsActionRow>
    </div>
  );
}
