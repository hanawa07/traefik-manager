import type { Dispatch, SetStateAction } from "react";

import type { TraefikDashboardSettingsInput } from "@/features/settings/api/settingsApi";

import { TraefikDashboardSettingsActions } from "./TraefikDashboardSettingsActions";

interface TraefikDashboardSettingsFormProps {
  formValue: TraefikDashboardSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  onFormChange: Dispatch<SetStateAction<TraefikDashboardSettingsInput>>;
  onSave: () => void;
  onCancel: () => void;
}

export function TraefikDashboardSettingsForm({
  formValue,
  errorMessage,
  isSaving,
  onFormChange,
  onSave,
  onCancel,
}: TraefikDashboardSettingsFormProps) {
  const updateForm = (patch: Partial<TraefikDashboardSettingsInput>) => {
    onFormChange((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="space-y-4">
      <label
        className={
          "flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 " +
          "bg-gray-50 p-3 text-sm text-gray-700"
        }
      >
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded accent-violet-600"
          checked={formValue.enabled}
          onChange={(event) => updateForm({ enabled: event.target.checked })}
        />
        <span>
          <span className="block font-medium text-gray-900">공개 라우트 활성화</span>
          <span className="mt-1 block text-xs text-gray-500">
            `api@internal`을 지정한 공개 도메인으로 연결합니다. 평소에는 끄고,
            디버깅할 때만 잠깐 켜는 용도입니다.
          </span>
        </span>
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        <TextField
          label="공개 도메인"
          placeholder="예: traefik-debug.lizstudio.co.kr"
          value={formValue.domain}
          onChange={(domain) => updateForm({ domain })}
        />
        <TextField
          label="기본 인증 사용자명"
          placeholder="예: debug-admin"
          value={formValue.auth_username}
          onChange={(auth_username) => updateForm({ auth_username })}
        />
      </div>

      <TextField
        label="기본 인증 비밀번호"
        type="password"
        placeholder="처음 활성화 시 필수, 비워두면 기존 비밀번호 유지"
        value={formValue.auth_password}
        help={
          "비밀번호는 해시로만 저장됩니다. 이 설정은 Traefik dashboard 엔진 자체를 " +
          "켜고 끄는 게 아니라, public route를 생성하거나 제거합니다."
        }
        onChange={(auth_password) => updateForm({ auth_password })}
      />

      <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
        <p>전제 조건: 외부 Traefik 정적 설정에서 `api.dashboard=true`가 켜져 있어야 합니다.</p>
        <p>보호 방식: 공개 도메인 + HTTPS + Traefik Basic Auth</p>
        <p>도메인 제약: 기존 서비스 또는 리다이렉트에서 사용하는 도메인과 중복될 수 없습니다.</p>
        <p>권장 운영: 디버깅 후 즉시 비활성화</p>
      </div>

      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

      <TraefikDashboardSettingsActions
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  help?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <p className="mt-1 text-xs text-gray-500">{help}</p> : null}
    </div>
  );
}
