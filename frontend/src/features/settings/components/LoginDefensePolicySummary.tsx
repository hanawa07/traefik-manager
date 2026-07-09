import type { LoginDefenseSettingsStatus } from "@/features/settings/api/settingsApi";
import { getTurnstileModeLabel } from "@/features/settings/lib/settingsFormHelpers";
import { formatDurationMinutes } from "@/shared/lib/formatDurationMinutes";

export function LoginDefensePolicySummary({
  settings,
}: {
  settings?: LoginDefenseSettingsStatus;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
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
