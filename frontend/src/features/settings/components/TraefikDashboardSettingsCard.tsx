import type { Dispatch, SetStateAction } from "react";
import { Bug, Save, X } from "lucide-react";

import type {
  TraefikDashboardSettingsInput,
  TraefikDashboardSettingsStatus,
} from "@/features/settings/api/settingsApi";
import {
  SettingsActionRow,
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";

interface TraefikDashboardSettingsCardProps {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  settings?: TraefikDashboardSettingsStatus;
  formValue: TraefikDashboardSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: Dispatch<SetStateAction<TraefikDashboardSettingsInput>>;
}

export function TraefikDashboardSettingsCard({
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
  onFormChange,
}: TraefikDashboardSettingsCardProps) {
  const updateForm = (patch: Partial<TraefikDashboardSettingsInput>) => {
    onFormChange((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="card p-6 h-full order-7">
      <SettingsCardHeader
        icon={<Bug className="w-5 h-5 text-violet-600" />}
        title="Traefik 디버그 대시보드"
        description={
          "내장 Traefik dashboard를 필요할 때만 공개 도메인으로 노출합니다. " +
          "기본적으로는 비공개로 두고, 디버깅이 끝나면 다시 끄는 것을 권장합니다."
        }
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ) : isEditing ? (
        <div className="space-y-4">
          <label
            className={
              "flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 " +
              "text-sm text-gray-700 cursor-pointer"
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
              <span className="block text-xs text-gray-500 mt-1">
                `api@internal`을 지정한 공개 도메인으로 연결합니다. 평소에는 끄고, 디버깅할 때만 잠깐
                켜는 용도입니다.
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
            help="비밀번호는 해시로만 저장됩니다. 이 설정은 Traefik dashboard 엔진 자체를 켜고 끄는 게 아니라, public route를 생성하거나 제거합니다."
            onChange={(auth_password) => updateForm({ auth_password })}
          />

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
            <p>전제 조건: 외부 Traefik 정적 설정에서 `api.dashboard=true`가 켜져 있어야 합니다.</p>
            <p>보호 방식: 공개 도메인 + HTTPS + Traefik Basic Auth</p>
            <p>도메인 제약: 기존 서비스 또는 리다이렉트에서 사용하는 도메인과 중복될 수 없습니다.</p>
            <p>권장 운영: 디버깅 후 즉시 비활성화</p>
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
      ) : (
        <SettingsSummary>
          <SettingsSummaryRow label="상태" value={settings?.enabled ? "활성화" : "비활성화"} />
          <SettingsSummaryRow
            label="공개 주소"
            value={
              settings?.public_url ? (
                <a
                  href={settings.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {settings.public_url}
                </a>
              ) : (
                "(미설정)"
              )
            }
            mono
          />
          <SettingsSummaryRow
            label="기본 인증 사용자"
            value={settings?.auth_username || "(미설정)"}
            mono
          />
          <SettingsSummaryRow
            label="비밀번호"
            value={settings?.auth_password_configured ? "설정됨" : "(미설정)"}
          />
          <SettingsSummaryRow
            label="라우트 준비 상태"
            value={settings?.configured ? "완료" : "불완전"}
          />
          <p className="text-xs text-gray-500">{settings?.message}</p>
          <p className="text-xs text-gray-500 pt-1">
            이 설정은 Traefik Manager가 dynamic route 파일을 생성/삭제해서 public 노출만 제어합니다.
          </p>
        </SettingsSummary>
      )}
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
