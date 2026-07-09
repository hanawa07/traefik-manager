import type { TraefikDashboardSettingsStatus } from "@/features/settings/api/settingsApi";
import {
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";

interface TraefikDashboardSettingsSummaryProps {
  settings?: TraefikDashboardSettingsStatus;
}

export function TraefikDashboardSettingsSummary({
  settings,
}: TraefikDashboardSettingsSummaryProps) {
  return (
    <SettingsSummary>
      <SettingsSummaryRow label="상태" value={settings?.enabled ? "활성화" : "비활성화"} />
      <SettingsSummaryRow label="공개 주소" value={getPublicUrlValue(settings)} mono />
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
      <p className="text-xs text-gray-500 dark:text-slate-400">{settings?.message}</p>
      <p className="text-xs text-gray-500 pt-1 dark:text-slate-400">
        이 설정은 Traefik Manager가 dynamic route 파일을 생성/삭제해서 public 노출만
        제어합니다.
      </p>
    </SettingsSummary>
  );
}

function getPublicUrlValue(settings?: TraefikDashboardSettingsStatus) {
  if (!settings?.public_url) return "(미설정)";

  return (
    <a
      href={settings.public_url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
    >
      {settings.public_url}
    </a>
  );
}
