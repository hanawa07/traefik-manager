import type { Dispatch, SetStateAction } from "react";
import { Save, X } from "lucide-react";

import type { LoginDefenseSettingsStatus } from "@/features/settings/api/settingsApi";
import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";
import type { LoginDefenseForm } from "@/features/settings/lib/settingsDefaults";
import { getTurnstileModeLabel } from "@/features/settings/lib/settingsFormHelpers";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";

interface LoginDefenseSettingsEditFormProps {
  settings?: LoginDefenseSettingsStatus;
  formValue: LoginDefenseForm;
  errorMessage: string;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: Dispatch<SetStateAction<LoginDefenseForm>>;
}

export function LoginDefenseSettingsEditForm({
  settings,
  formValue,
  errorMessage,
  isSaving,
  onSave,
  onCancel,
  onFormChange,
}: LoginDefenseSettingsEditFormProps) {
  const updateForm = (patch: Partial<LoginDefenseForm>) => {
    onFormChange((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="space-y-4">
      <LoginDefensePolicySummary settings={settings} />

      <LoginDefenseCheckboxRow
        checked={formValue.suspicious_block_enabled}
        accentClassName="accent-amber-600"
        title="이상 징후 IP 자동 차단 활성화"
        description="`login_suspicious`가 기록된 IP는 일정 시간 로그인 단계에서 바로 차단합니다."
        onChange={(checked) => updateForm({ suspicious_block_enabled: checked })}
      />

      <div>
        <label className="label">신뢰 네트워크 예외 (CIDR / IP)</label>
        <textarea
          className="input min-h-28 py-3 font-mono text-sm"
          placeholder={"예:\n10.0.0.0/8\n192.168.0.0/16\n203.0.113.10"}
          value={formValue.suspicious_trusted_networks_text}
          onChange={(event) => updateForm({ suspicious_trusted_networks_text: event.target.value })}
        />
        <p className="mt-1 text-xs text-gray-500">
          줄바꿈 또는 쉼표로 구분합니다. 여기에 포함된 IP는 이상 징후 기록과 자동 차단에서 제외됩니다.
          사용자별 계정 잠금은 그대로 적용됩니다.
        </p>
      </div>

      <LoginDefenseCheckboxRow
        checked={formValue.suspicious_block_escalation_enabled}
        accentClassName="accent-amber-600"
        title="반복 차단 시간 자동 상승"
        description="같은 IP가 반복해서 다시 차단되면 차단 시간을 자동으로 늘립니다."
        onChange={(checked) => updateForm({ suspicious_block_escalation_enabled: checked })}
      />

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

      <div>
        <label className="label">Cloudflare Turnstile 적용 모드</label>
        <select
          className="input"
          value={formValue.turnstile_mode}
          onChange={(event) =>
            updateForm({
              turnstile_mode: event.target.value as LoginDefenseForm["turnstile_mode"],
            })
          }
        >
          <option value="off">비활성화</option>
          <option value="always">항상 적용</option>
          <option value="risk_based">위험 기반 적용</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          위험 기반 적용은 최근 실패가 누적된 IP에서만 Turnstile 검증을 요구합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Turnstile Site Key</label>
          <input
            type="text"
            className="input font-mono text-sm"
            placeholder="0x4AAAAA..."
            value={formValue.turnstile_site_key}
            onChange={(event) => updateForm({ turnstile_site_key: event.target.value })}
          />
          <p className="mt-1 text-xs text-gray-500">로그인 페이지에 공개로 노출되는 site key입니다.</p>
        </div>
        <div>
          <label className="label">Turnstile Secret Key</label>
          <input
            type="password"
            className="input font-mono text-sm"
            placeholder={settings?.turnstile_secret_key_configured ? "기존 secret 유지" : "secret key 입력"}
            value={formValue.turnstile_secret_key}
            onChange={(event) => updateForm({ turnstile_secret_key: event.target.value })}
          />
          <p className="mt-1 text-xs text-gray-500">
            {settings?.turnstile_secret_key_configured
              ? "비워두면 기존 secret key를 유지합니다."
              : "Cloudflare Turnstile secret key를 입력합니다."}
          </p>
        </div>
      </div>

      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}

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

function LoginDefensePolicySummary({
  settings,
}: {
  settings?: LoginDefenseSettingsStatus;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
      <p>
        계정 잠금 정책: {formatDurationMinutes(settings?.failure_window_minutes)} 동안 {settings?.max_failed_attempts}회
        실패 시 {formatDurationMinutes(settings?.lockout_minutes)} 잠금
      </p>
      <p>
        이상 징후 기준: {formatDurationMinutes(settings?.suspicious_window_minutes)} 동안{" "}
        {settings?.suspicious_failure_count}회 실패 + 서로 다른 사용자명 {settings?.suspicious_username_count}개 이상
      </p>
      <p>자동 차단 기간: {formatDurationMinutes(settings?.suspicious_block_minutes)}</p>
      <p>
        반복 차단 상승:{" "}
        {settings?.suspicious_block_escalation_enabled
          ? `${formatDurationMinutes(settings.suspicious_block_escalation_window_minutes)} 창 / ` +
            `x${settings.suspicious_block_escalation_multiplier} / 최대 ` +
            formatDurationMinutes(settings.suspicious_block_max_minutes)
          : "비활성화"}
      </p>
      <p>추가 로그인 검증: {getTurnstileModeLabel(settings?.turnstile_mode ?? "off")}</p>
    </div>
  );
}

function LoginDefenseCheckboxRow({
  checked,
  accentClassName,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  accentClassName: string;
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
        className={`mt-0.5 h-4 w-4 rounded ${accentClassName}`}
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
