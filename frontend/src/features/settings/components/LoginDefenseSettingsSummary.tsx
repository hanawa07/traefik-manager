import type { LoginDefenseSettingsStatus } from "@/features/settings/api/settingsApi";
import {
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import { getTurnstileModeLabel } from "@/features/settings/lib/settingsFormHelpers";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";

interface LoginDefenseSettingsSummaryProps {
  settings?: LoginDefenseSettingsStatus;
}

export function LoginDefenseSettingsSummary({ settings }: LoginDefenseSettingsSummaryProps) {
  return (
    <SettingsSummary>
      <SettingsSummaryRow
        label="계정 잠금 정책"
        value={
          `${formatDurationMinutes(settings?.failure_window_minutes)} / ` +
          `${settings?.max_failed_attempts}회 실패 시 ` +
          `${formatDurationMinutes(settings?.lockout_minutes)} 잠금`
        }
      />
      <SettingsSummaryRow
        label="이상 징후 감지"
        value={
          `${formatDurationMinutes(settings?.suspicious_window_minutes)} / ` +
          `${settings?.suspicious_failure_count}회 실패 / 사용자명 ` +
          `${settings?.suspicious_username_count}개`
        }
      />
      <SettingsSummaryRow
        label="자동 차단"
        value={
          settings?.suspicious_block_enabled
            ? `${formatDurationMinutes(settings.suspicious_block_minutes)} 활성화`
            : "비활성화"
        }
      />
      <SettingsSummaryRow
        label="반복 차단 상승"
        value={
          settings?.suspicious_block_escalation_enabled
            ? `${formatDurationMinutes(settings.suspicious_block_escalation_window_minutes)} 창 / ` +
              `x${settings.suspicious_block_escalation_multiplier} / 최대 ` +
              formatDurationMinutes(settings.suspicious_block_max_minutes)
            : "비활성화"
        }
      />
      <SettingsSummaryRow label="추가 로그인 검증" value={getTurnstileModeLabel(settings?.turnstile_mode ?? "off")} />
      {settings?.turnstile_mode !== "off" ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          <p>모드: {getTurnstileModeLabel(settings?.turnstile_mode ?? "off")}</p>
          <p>Site Key: {settings?.turnstile_site_key || "(미설정)"}</p>
          <p>Secret Key: {settings?.turnstile_secret_key_configured ? "설정됨" : "(미설정)"}</p>
        </div>
      ) : null}
      {settings?.suspicious_trusted_networks?.length ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950">
          <p className="mb-2 text-xs font-medium text-gray-600 dark:text-slate-300">신뢰 네트워크 예외</p>
          <div className="flex flex-wrap gap-2">
            {settings.suspicious_trusted_networks.map((network) => (
              <span
                key={network}
                className={
                  "rounded-full border border-gray-200 bg-white px-2.5 py-1 " +
                  "font-mono text-[11px] text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                }
              >
                {network}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-slate-400">등록된 신뢰 네트워크 예외가 없습니다.</p>
      )}
      <p className="text-xs text-gray-500 dark:text-slate-400">
        신뢰 네트워크 예외는 내부 NAT, VPN, 사내망처럼 반복 실패가 운영 노이즈로 잡힐 수 있는 경로에만
        제한적으로 사용하세요.
      </p>
    </SettingsSummary>
  );
}
