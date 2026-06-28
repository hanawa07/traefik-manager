import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Save, X } from "lucide-react";

import type { CloudflareZoneInput } from "@/features/settings/api/settingsApi";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";
import { createDefaultCloudflareZoneForm } from "@/features/settings/lib/settingsDefaults";

interface CloudflareDnsEditFormProps {
  zones: CloudflareZoneInput[];
  errorMessage: string;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: Dispatch<SetStateAction<CloudflareZoneInput[]>>;
}

export function CloudflareDnsEditForm({
  zones,
  errorMessage,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: CloudflareDnsEditFormProps) {
  const updateZone = (index: number, patch: Partial<CloudflareZoneInput>) => {
    onFormChange((current) =>
      current.map((zone, currentIndex) =>
        currentIndex === index ? { ...zone, ...patch } : zone,
      ),
    );
  };
  const addZone = () => {
    onFormChange((current) => [...current, createDefaultCloudflareZoneForm()]);
  };
  const removeZone = (index: number) => {
    onFormChange((current) =>
      current.length === 1
        ? [createDefaultCloudflareZoneForm()]
        : current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  return (
    <div className="space-y-4">
      {zones.map((zone, index) => (
        <CloudflareZoneForm
          key={`cf-zone-${index}`}
          zone={zone}
          index={index}
          canRemove={zones.length > 1}
          onUpdate={updateZone}
          onRemove={removeZone}
        />
      ))}

      <button type="button" className="btn-secondary py-1.5 text-xs" onClick={addZone}>
        영역 추가
      </button>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
        <p>멀티존 지원: 여러 Cloudflare zone을 나란히 저장할 수 있습니다.</p>
        <p>비Cloudflare 도메인: 저장/드리프트/재동기화 대상에서 자동 제외되며, 진단 결과에 제외 사유가 표시됩니다.</p>
        <p>모든 영역을 비우고 저장하면 Cloudflare 자동 연동 설정이 완전히 초기화됩니다.</p>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

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

function CloudflareZoneForm({
  zone,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: {
  zone: CloudflareZoneInput;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, patch: Partial<CloudflareZoneInput>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Cloudflare 영역 {index + 1}</p>
          <p className="text-xs text-gray-500">한 zone과 그 하위 도메인만 자동 연동 대상으로 포함됩니다.</p>
        </div>
        <button
          type="button"
          className="btn-secondary py-1.5 text-xs"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
        >
          영역 제거
        </button>
      </div>

      <TextField
        label="API Token"
        type="password"
        placeholder="새 토큰 입력 (비워두면 기존 값 유지가 아니라 이 영역 저장 자체가 비활성화됩니다)"
        value={zone.api_token}
        help={
          <>
            Cloudflare → My Profile → API Tokens → Create Token →{" "}
            <strong>Zone:DNS:Edit</strong>, <strong>Zone:Zone:Read</strong> 권한이 필요합니다.
          </>
        }
        onChange={(api_token) => onUpdate(index, { api_token })}
      />
      <TextField
        label="Zone ID"
        value={zone.zone_id}
        help="Cloudflare 도메인 대시보드 우측 하단 `Zone ID`. 이 zone에 속한 도메인만 자동 DNS 등록과 드리프트 진단 대상이 됩니다."
        onChange={(zone_id) => onUpdate(index, { zone_id })}
      />
      <TextField
        label="Record Target"
        labelSuffix="(선택)"
        placeholder="예: 1.2.3.4 (비워두면 서비스 업스트림 호스트 사용)"
        value={zone.record_target}
        help={
          "DNS A/CNAME 레코드가 가리킬 대상입니다. 비워두면 서비스 upstream_host를 사용하지만, " +
          "upstream이 내부 IP인 경우 공인 IP나 외부 hostname을 직접 입력해야 합니다."
        }
        onChange={(record_target) => onUpdate(index, { record_target })}
      />

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={zone.proxied}
            onChange={(event) => onUpdate(index, { proxied: event.target.checked })}
          />
          Cloudflare Proxy (Proxied) 사용
        </label>
        <p className="text-xs text-gray-400 mt-1">
          활성화 시 트래픽이 Cloudflare를 경유하며 실제 서버 IP가 숨겨집니다. DNS only가 필요하면 체크를 해제하세요.
        </p>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  help,
  labelSuffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  help?: ReactNode;
  labelSuffix?: string;
}) {
  return (
    <div>
      <label className="label">
        {label} {labelSuffix ? <span className="text-gray-400 font-normal">{labelSuffix}</span> : null}
      </label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <p className="text-xs text-gray-400 mt-1">{help}</p> : null}
    </div>
  );
}
