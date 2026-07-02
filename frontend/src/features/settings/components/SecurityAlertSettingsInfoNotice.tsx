import type { SecurityAlertSettingsStatus } from "@/features/settings/api/settingsApi";

interface SecurityAlertSettingsInfoNoticeProps {
  settings?: SecurityAlertSettingsStatus;
}

export function SecurityAlertSettingsInfoNotice({
  settings,
}: SecurityAlertSettingsInfoNoticeProps) {
  return (
    <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
      <p>전송 이벤트: {(settings?.alert_events ?? []).join(", ")}</p>
      <p>전송 타임아웃: {settings?.timeout_seconds ?? 5}초</p>
      <p>이벤트별 override는 Telegram, PagerDuty, Email 또는 전송 안 함으로만 분기합니다.</p>
      <p>알림 실패는 로그인/차단 동작을 막지 않고 서버 로그에만 남습니다.</p>
    </div>
  );
}
