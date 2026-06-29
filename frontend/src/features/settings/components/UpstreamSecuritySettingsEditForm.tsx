import { Save, X } from "lucide-react";

import type { UpstreamSecuritySettingsStatus } from "@/features/settings/api/settingsApi";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";
import type { UpstreamSecurityForm } from "@/features/settings/lib/settingsDefaults";
import {
  applyUpstreamPreset,
  inferUpstreamPresetKey,
} from "@/features/settings/lib/settingsFormHelpers";

interface UpstreamSecuritySettingsEditFormProps {
  settings?: UpstreamSecuritySettingsStatus;
  formValue: UpstreamSecurityForm;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: (value: UpstreamSecurityForm) => void;
}

export function UpstreamSecuritySettingsEditForm({
  settings,
  formValue,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: UpstreamSecuritySettingsEditFormProps) {
  const presets = settings?.available_presets ?? [];
  const selectedPresetKey = inferUpstreamPresetKey(presets, formValue);

  return (
    <div className="space-y-4">
      <div>
        <label className="label">정책 preset</label>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {presets.map((preset) => {
            const isSelected = selectedPresetKey === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                className={`rounded-xl border p-3 text-left transition ${
                  isSelected ? "border-rose-300 bg-rose-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
                onClick={() => onFormChange(applyUpstreamPreset(formValue, preset))}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-900">{preset.name}</span>
                  {isSelected ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                      현재 조합
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500">{preset.description}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          preset을 누르면 권장 조합이 바로 적용됩니다. 이후 세부 옵션을 직접 바꾸면 조합은 자동으로 `사용자 정의`
          상태가 됩니다.
        </p>
        {selectedPresetKey === "custom" ? (
          <p className="mt-1 text-xs font-medium text-amber-700">
            현재 조합은 preset과 다르게 직접 조정된 사용자 정의 상태입니다.
          </p>
        ) : null}
      </div>

      <CheckboxRow
        checked={formValue.dns_strict_mode}
        title="DNS strict mode 활성화"
        description={
          "도메인 업스트림 저장 시 DNS를 다시 조회해서 loopback, link-local, 문서 예제 대역 같은 금지 주소로 해석되는지 검사합니다."
        }
        onChange={(checked) => onFormChange({ ...formValue, dns_strict_mode: checked })}
      />

      <CheckboxRow
        checked={formValue.allowlist_enabled}
        title="업스트림 allowlist 활성화"
        description="외부 FQDN은 아래 suffix 목록과 일치해야만 저장할 수 있습니다. strict mode와는 별개로 동작합니다."
        onChange={(checked) => onFormChange({ ...formValue, allowlist_enabled: checked })}
      />

      <div>
        <label className="label">허용 도메인 suffix</label>
        <textarea
          className="input min-h-28 py-3 font-mono text-sm"
          placeholder={"예:\nexample.com\nhanadays.co.kr"}
          value={formValue.allowed_domain_suffixes_text}
          onChange={(event) =>
            onFormChange({
              ...formValue,
              allowed_domain_suffixes_text: event.target.value,
            })
          }
        />
        <p className="mt-1 text-xs text-gray-500">
          줄바꿈 또는 쉼표로 구분합니다. `*.example.com` 입력도 허용됩니다.
        </p>
      </div>

      <CheckboxRow
        checked={formValue.allow_docker_service_names}
        title="Docker 서비스명 허용"
        description="`vaultwarden`, `open-webui` 같은 점 없는 내부 호스트명을 허용합니다."
        onChange={(checked) => onFormChange({ ...formValue, allow_docker_service_names: checked })}
      />

      <CheckboxRow
        checked={formValue.allow_private_networks}
        title="사설 IPv4 / Tailscale IP 허용"
        description="`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`, `100.64.0.0/10` 대역 IP 리터럴을 허용합니다."
        onChange={(checked) => onFormChange({ ...formValue, allow_private_networks: checked })}
      />

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
        <p>기본값은 비활성화입니다.</p>
        <p>권장 사용처: 외부 FQDN을 업스트림으로 자주 등록하는 환경</p>
        <p>주의: allowlist를 켠 상태에서 suffix 목록이 비어 있으면 외부 FQDN은 모두 차단됩니다.</p>
        <p>주의: DNS 조회 실패 시 strict mode가 켜져 있으면 서비스 저장이 차단됩니다.</p>
      </div>

      <SettingsActionRow>
        <button className="btn-primary flex items-center gap-1.5 py-1.5 text-xs" onClick={onSave} disabled={isSaving}>
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
        className="mt-0.5 h-4 w-4 rounded accent-rose-600"
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
