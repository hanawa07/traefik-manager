import type { LoginDefenseSettingsStatus } from "@/features/settings/api/settingsApi";
import type { LoginDefenseUpdateForm } from "@/features/settings/components/LoginDefenseFormTypes";
import type { LoginDefenseForm } from "@/features/settings/lib/settingsDefaults";

export function LoginDefenseTurnstileSection({
  settings,
  formValue,
  updateForm,
}: {
  settings?: LoginDefenseSettingsStatus;
  formValue: LoginDefenseForm;
  updateForm: LoginDefenseUpdateForm;
}) {
  return (
    <>
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
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
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
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">로그인 페이지에 공개로 노출되는 site key입니다.</p>
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
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {settings?.turnstile_secret_key_configured
              ? "비워두면 기존 secret key를 유지합니다."
              : "Cloudflare Turnstile secret key를 입력합니다."}
          </p>
        </div>
      </div>
    </>
  );
}
