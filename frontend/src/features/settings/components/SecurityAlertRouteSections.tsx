import type {
  ChangeAlertRouteEvent,
  SecurityAlertRouteEvent,
  SecurityAlertRouteTarget,
  SecurityAlertSettingsInput,
} from "@/features/settings/api/settingsApi";
import { SecurityAlertRoutePolicySection } from "@/features/settings/components/SecurityAlertRoutePolicySection";
import {
  CHANGE_ALERT_EVENT_OPTIONS,
  SECURITY_ALERT_EVENT_OPTIONS,
} from "@/features/settings/lib/settingsDefaults";

interface SecurityAlertRouteSectionsProps {
  formValue: SecurityAlertSettingsInput;
  providerLabel: string;
  setChangeRoute: (key: ChangeAlertRouteEvent, route: SecurityAlertRouteTarget) => void;
  setSecurityRoute: (key: SecurityAlertRouteEvent, route: SecurityAlertRouteTarget) => void;
}

export function SecurityAlertRouteSections({
  formValue,
  providerLabel,
  setChangeRoute,
  setSecurityRoute,
}: SecurityAlertRouteSectionsProps) {
  return (
    <>
      <SecurityAlertRoutePolicySection
        title="이벤트별 알림 정책"
        description="기본 채널은 현재 선택한 provider를 뜻합니다. 독립 설정 채널은 Telegram, PagerDuty, Email만 override로 지정할 수 있습니다."
        events={SECURITY_ALERT_EVENT_OPTIONS}
        routes={formValue.event_routes}
        providerLabel={providerLabel}
        onChange={setSecurityRoute}
      />
      <SecurityAlertRoutePolicySection
        title="운영 변경 알림 정책"
        description="기본 채널은 현재 선택한 provider를 뜻합니다. 운영 변경 알림은 전체 on/off와 이벤트군별 route를 따로 가집니다."
        events={CHANGE_ALERT_EVENT_OPTIONS}
        routes={formValue.change_event_routes}
        providerLabel={providerLabel}
        onChange={setChangeRoute}
      />
    </>
  );
}
