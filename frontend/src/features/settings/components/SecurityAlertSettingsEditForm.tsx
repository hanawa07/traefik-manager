import type { Dispatch, SetStateAction } from "react";
import { Save, X } from "lucide-react";

import type {
  ChangeAlertRouteEvent,
  SecurityAlertRouteEvent,
  SecurityAlertRouteTarget,
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
} from "@/features/settings/api/settingsApi";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";
import {
  SecurityAlertProviderFields,
  SecurityAlertProviderPicker,
} from "@/features/settings/components/SecurityAlertProviderFields";
import { SecurityAlertRoutePolicySection } from "@/features/settings/components/SecurityAlertRoutePolicySection";
import {
  CHANGE_ALERT_EVENT_OPTIONS,
  SECURITY_ALERT_EVENT_OPTIONS,
  SECURITY_ALERT_PROVIDER_OPTIONS,
} from "@/features/settings/lib/settingsDefaults";

interface SecurityAlertSettingsEditFormProps {
  settings?: SecurityAlertSettingsStatus;
  formValue: SecurityAlertSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: Dispatch<SetStateAction<SecurityAlertSettingsInput>>;
}

export function SecurityAlertSettingsEditForm({
  settings,
  formValue,
  errorMessage,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: SecurityAlertSettingsEditFormProps) {
  const selectedProvider =
    SECURITY_ALERT_PROVIDER_OPTIONS.find((option) => option.value === formValue.provider) ??
    SECURITY_ALERT_PROVIDER_OPTIONS[0];
  const updateForm = (patch: Partial<SecurityAlertSettingsInput>) => {
    onFormChange((current) => ({ ...current, ...patch }));
  };
  const setSecurityRoute = (key: SecurityAlertRouteEvent, route: SecurityAlertRouteTarget) => {
    onFormChange((current) => ({
      ...current,
      event_routes: { ...current.event_routes, [key]: route },
    }));
  };
  const setChangeRoute = (key: ChangeAlertRouteEvent, route: SecurityAlertRouteTarget) => {
    onFormChange((current) => ({
      ...current,
      change_event_routes: { ...current.change_event_routes, [key]: route },
    }));
  };

  return (
    <div className="space-y-4">
      <CheckboxRow
        checked={formValue.enabled}
        title="보안 웹훅 알림 활성화"
        description="보안 경고 이벤트가 발생하면 JSON payload를 webhook endpoint로 전송합니다."
        onChange={(checked) => updateForm({ enabled: checked })}
      />
      <CheckboxRow
        checked={formValue.change_alerts_enabled}
        title="운영 변경 알림 활성화"
        description="설정, 서비스, 리다이렉트, 미들웨어, 사용자 변경과 롤백 이벤트를 같은 채널 정책으로 전달합니다."
        onChange={(checked) => updateForm({ change_alerts_enabled: checked })}
      />

      <SecurityAlertProviderPicker value={formValue.provider} onChange={(provider) => updateForm({ provider })} />
      <SecurityAlertProviderFields
        formValue={formValue}
        settings={settings}
        selectedProvider={selectedProvider}
        updateForm={updateForm}
      />
      <SecurityAlertRoutePolicySection
        title="이벤트별 알림 정책"
        description="기본 채널은 현재 선택한 provider를 뜻합니다. 독립 설정 채널은 Telegram, PagerDuty, Email만 override로 지정할 수 있습니다."
        events={SECURITY_ALERT_EVENT_OPTIONS}
        routes={formValue.event_routes}
        providerLabel={selectedProvider.label}
        onChange={setSecurityRoute}
      />
      <SecurityAlertRoutePolicySection
        title="운영 변경 알림 정책"
        description="기본 채널은 현재 선택한 provider를 뜻합니다. 운영 변경 알림은 전체 on/off와 이벤트군별 route를 따로 가집니다."
        events={CHANGE_ALERT_EVENT_OPTIONS}
        routes={formValue.change_event_routes}
        providerLabel={selectedProvider.label}
        onChange={setChangeRoute}
      />

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
        <p>전송 이벤트: {(settings?.alert_events ?? []).join(", ")}</p>
        <p>전송 타임아웃: {settings?.timeout_seconds ?? 5}초</p>
        <p>이벤트별 override는 Telegram, PagerDuty, Email 또는 전송 안 함으로만 분기합니다.</p>
        <p>알림 실패는 로그인/차단 동작을 막지 않고 서버 로그에만 남습니다.</p>
      </div>
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

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
  );
}

function CheckboxRow({
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
        "flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 " +
        "text-sm text-gray-700 cursor-pointer"
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
        <span className="block text-xs text-gray-500 mt-1">{description}</span>
      </span>
    </label>
  );
}
