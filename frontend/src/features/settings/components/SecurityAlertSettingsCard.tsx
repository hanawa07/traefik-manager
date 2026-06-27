import type { Dispatch, SetStateAction } from "react";
import { Cloud, Save, X } from "lucide-react";

import type {
  ChangeAlertRouteEvent,
  SecurityAlertRouteEvent,
  SecurityAlertRouteTarget,
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import {
  SettingsActionRow,
  SettingsCardHeader,
  SettingsSummary,
  SettingsSummaryRow,
} from "@/features/settings/components/SettingsCardPrimitives";
import {
  ActionResultNotice,
  SettingsTestHistoryNotice,
} from "@/features/settings/components/SettingsNotices";
import {
  SecurityAlertProviderFields,
  SecurityAlertProviderPicker,
} from "@/features/settings/components/SecurityAlertProviderFields";
import {
  CHANGE_ALERT_EVENT_OPTIONS,
  SECURITY_ALERT_EVENT_OPTIONS,
  SECURITY_ALERT_PROVIDER_OPTIONS,
  SECURITY_ALERT_ROUTE_OPTIONS,
} from "@/features/settings/lib/settingsDefaults";
import { getSecurityAlertRouteLabel } from "@/features/settings/lib/settingsFormHelpers";

interface SecurityAlertSettingsCardProps {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  settings?: SecurityAlertSettingsStatus;
  formValue: SecurityAlertSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  isTesting: boolean;
  isHistoryLoading: boolean;
  displayTimezone?: string;
  testResult: SettingsActionTestResult | null;
  securityRetryResult: SettingsActionTestResult | null;
  changeRetryResult: SettingsActionTestResult | null;
  securityTestHistory?: SettingsTestHistoryItem | null;
  securityDeliveryHistory?: SettingsTestHistoryItem | null;
  changeDeliveryHistory?: SettingsTestHistoryItem | null;
  isRetryingSecurityDelivery: boolean;
  isRetryingChangeDelivery: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTest: () => void;
  onRetrySecurityDelivery: () => void;
  onRetryChangeDelivery: () => void;
  onFormChange: Dispatch<SetStateAction<SecurityAlertSettingsInput>>;
}

export function SecurityAlertSettingsCard({
  canManage,
  isLoading,
  isEditing,
  settings,
  formValue,
  errorMessage,
  isSaving,
  isTesting,
  isHistoryLoading,
  displayTimezone,
  testResult,
  securityRetryResult,
  changeRetryResult,
  securityTestHistory,
  securityDeliveryHistory,
  changeDeliveryHistory,
  isRetryingSecurityDelivery,
  isRetryingChangeDelivery,
  onEdit,
  onSave,
  onCancel,
  onTest,
  onRetrySecurityDelivery,
  onRetryChangeDelivery,
  onFormChange,
}: SecurityAlertSettingsCardProps) {
  const selectedProvider =
    SECURITY_ALERT_PROVIDER_OPTIONS.find((option) => option.value === formValue.provider) ??
    SECURITY_ALERT_PROVIDER_OPTIONS[0];
  const currentProvider =
    SECURITY_ALERT_PROVIDER_OPTIONS.find((option) => option.value === (settings?.provider ?? "generic")) ??
    SECURITY_ALERT_PROVIDER_OPTIONS[0];
  const updateForm = (patch: Partial<SecurityAlertSettingsInput>) => {
    onFormChange((current) => ({ ...current, ...patch }));
  };
  const setSecurityRoute = (key: SecurityAlertRouteEvent, route: SecurityAlertRouteTarget) => {
    onFormChange((current) => ({
      ...current,
      event_routes: { ...current.event_routes, [key]: route },
    }));
  };
  const setChangeRoute = (key: ChangeAlertRouteEvent, route: SecurityAlertRouteTarget) => {
    onFormChange((current) => ({
      ...current,
      change_event_routes: { ...current.change_event_routes, [key]: route },
    }));
  };

  return (
    <div className="card p-6 h-full order-9">
      <SettingsCardHeader
        icon={<Cloud className="w-5 h-5 text-sky-600" />}
        title="보안 알림"
        description="보안 이벤트와 운영 변경 이벤트를 외부 채널로 전달합니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ) : isEditing ? (
        <div className="space-y-4">
          <CheckboxRow
            checked={formValue.enabled}
            title="보안 웹훅 알림 활성화"
            description="보안 경고 이벤트가 발생하면 JSON payload를 webhook endpoint로 전송합니다."
            onChange={(checked) => updateForm({ enabled: checked })}
          />
          <CheckboxRow
            checked={formValue.change_alerts_enabled}
            title="운영 변경 알림 활성화"
            description="설정, 서비스, 리다이렉트, 미들웨어, 사용자 변경과 롤백 이벤트를 같은 채널 정책으로 전달합니다."
            onChange={(checked) => updateForm({ change_alerts_enabled: checked })}
          />

          <SecurityAlertProviderPicker
            value={formValue.provider}
            onChange={(provider) => updateForm({ provider })}
          />
          <SecurityAlertProviderFields
            formValue={formValue}
            settings={settings}
            selectedProvider={selectedProvider}
            updateForm={updateForm}
          />
          <RoutePolicySection
            title="이벤트별 알림 정책"
            description="기본 채널은 현재 선택한 provider를 뜻합니다. 독립 설정 채널은 Telegram, PagerDuty, Email만 override로 지정할 수 있습니다."
            events={SECURITY_ALERT_EVENT_OPTIONS}
            routes={formValue.event_routes}
            providerLabel={selectedProvider.label}
            onChange={setSecurityRoute}
          />
          <RoutePolicySection
            title="운영 변경 알림 정책"
            description="기본 채널은 현재 선택한 provider를 뜻합니다. 운영 변경 알림은 전체 on/off와 이벤트군별 route를 따로 가집니다."
            events={CHANGE_ALERT_EVENT_OPTIONS}
            routes={formValue.change_event_routes}
            providerLabel={selectedProvider.label}
            onChange={setChangeRoute}
          />

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
            <p>전송 이벤트: {(settings?.alert_events ?? []).join(", ")}</p>
            <p>전송 타임아웃: {settings?.timeout_seconds ?? 5}초</p>
            <p>이벤트별 override는 Telegram, PagerDuty, Email 또는 전송 안 함으로만 분기합니다.</p>
            <p>알림 실패는 로그인/차단 동작을 막지 않고 서버 로그에만 남습니다.</p>
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
        <SecurityAlertSummary
          canManage={canManage}
          settings={settings}
          provider={currentProvider}
          isTesting={isTesting}
          isHistoryLoading={isHistoryLoading}
          displayTimezone={displayTimezone}
          testResult={testResult}
          securityRetryResult={securityRetryResult}
          changeRetryResult={changeRetryResult}
          securityTestHistory={securityTestHistory}
          securityDeliveryHistory={securityDeliveryHistory}
          changeDeliveryHistory={changeDeliveryHistory}
          isRetryingSecurityDelivery={isRetryingSecurityDelivery}
          isRetryingChangeDelivery={isRetryingChangeDelivery}
          onTest={onTest}
          onRetrySecurityDelivery={onRetrySecurityDelivery}
          onRetryChangeDelivery={onRetryChangeDelivery}
        />
      )}
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
        className="mt-0.5 h-4 w-4 rounded accent-sky-600"
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

function RoutePolicySection<T extends string>({
  title,
  description,
  events,
  routes,
  providerLabel,
  onChange,
}: {
  title: string;
  description: string;
  events: Array<{ key: T; label: string }>;
  routes: Record<T, SecurityAlertRouteTarget>;
  providerLabel: string;
  onChange: (key: T, route: SecurityAlertRouteTarget) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      <div className="grid gap-3">
        {events.map((eventOption) => (
          <div key={eventOption.key} className="grid gap-2 md:grid-cols-[140px_1fr] md:items-center">
            <label className="label mb-0">{eventOption.label}</label>
            <select
              className="input"
              value={routes[eventOption.key]}
              onChange={(event) => onChange(eventOption.key, event.target.value as SecurityAlertRouteTarget)}
            >
              {SECURITY_ALERT_ROUTE_OPTIONS.map((option) => (
                <option key={`${eventOption.key}-${option.value}`} value={option.value}>
                  {option.value === "default" ? `${option.label} (${providerLabel})` : option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

type SecurityAlertSummaryProps = Omit<
  SecurityAlertSettingsCardProps,
  | "isLoading"
  | "isEditing"
  | "formValue"
  | "errorMessage"
  | "isSaving"
  | "onEdit"
  | "onSave"
  | "onCancel"
  | "onFormChange"
> & {
  provider: (typeof SECURITY_ALERT_PROVIDER_OPTIONS)[number];
};

function SecurityAlertSummary({
  canManage,
  settings,
  provider,
  isTesting,
  isHistoryLoading,
  displayTimezone,
  testResult,
  securityRetryResult,
  changeRetryResult,
  securityTestHistory,
  securityDeliveryHistory,
  changeDeliveryHistory,
  isRetryingSecurityDelivery,
  isRetryingChangeDelivery,
  onTest,
  onRetrySecurityDelivery,
  onRetryChangeDelivery,
}: SecurityAlertSummaryProps) {
  return (
    <SettingsSummary>
      <SettingsSummaryRow label="상태" value={settings?.enabled ? "활성화" : "비활성화"} />
      <SettingsSummaryRow label="운영 변경 알림" value={settings?.change_alerts_enabled ? "활성화" : "비활성화"} />
      <SettingsSummaryRow label="채널" value={provider.label} />
      <ProviderSummary settings={settings} />
      <SettingsSummaryRow label="포맷" value={provider.description} />
      <SettingsSummaryRow label="전송 이벤트" value={(settings?.alert_events ?? []).join(", ")} />
      {SECURITY_ALERT_EVENT_OPTIONS.map((eventOption) => (
        <SettingsSummaryRow
          key={`summary-${eventOption.key}`}
          label={eventOption.label}
          value={getSecurityAlertRouteLabel(settings?.event_routes?.[eventOption.key] ?? "default", provider.label)}
        />
      ))}
      {CHANGE_ALERT_EVENT_OPTIONS.map((eventOption) => (
        <SettingsSummaryRow
          key={`summary-change-${eventOption.key}`}
          label={eventOption.label}
          value={getSecurityAlertRouteLabel(
            settings?.change_event_routes?.[eventOption.key] ?? "default",
            provider.label,
          )}
        />
      ))}
      <SettingsSummaryRow label="타임아웃" value={`${settings?.timeout_seconds ?? 5}초`} />
      {canManage ? (
        <SettingsActionRow>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2 py-1.5 text-xs"
            onClick={onTest}
            disabled={isTesting}
          >
            <Cloud className="h-3.5 w-3.5" />
            {isTesting ? "전송 중..." : "테스트 알림 전송"}
          </button>
        </SettingsActionRow>
      ) : null}
      <p className="text-xs text-gray-500">테스트는 현재 저장된 기본 채널 설정 기준으로 즉시 전송됩니다.</p>
      {!isHistoryLoading ? (
        <div className="space-y-3">
          <SettingsTestHistoryNotice
            label="마지막 테스트 알림"
            history={securityTestHistory}
            timezone={displayTimezone}
          />
          <SettingsTestHistoryNotice
            label="최근 보안 이벤트 전송"
            history={securityDeliveryHistory}
            timezone={displayTimezone}
            onRetry={onRetrySecurityDelivery}
            isRetrying={isRetryingSecurityDelivery}
          />
          <SettingsTestHistoryNotice
            label="최근 운영 변경 전송"
            history={changeDeliveryHistory}
            timezone={displayTimezone}
            onRetry={onRetryChangeDelivery}
            isRetrying={isRetryingChangeDelivery}
          />
        </div>
      ) : null}
      <ActionResultNotice result={testResult} />
      <ActionResultNotice result={securityRetryResult} />
      <ActionResultNotice result={changeRetryResult} />
      <p className="text-xs text-gray-500">
        알림 실패는 운영 가시성에만 영향을 주고, 로그인 차단/잠금 로직 자체는 중단하지 않습니다.
      </p>
    </SettingsSummary>
  );
}

function ProviderSummary({ settings }: { settings?: SecurityAlertSettingsStatus }) {
  if (settings?.provider === "telegram") {
    return (
      <>
        <SettingsSummaryRow label="Bot Token" value={settings.telegram_bot_token_configured ? "설정됨" : "(미설정)"} />
        <SettingsSummaryRow label="Chat ID" value={settings.telegram_chat_id || "(미설정)"} mono />
      </>
    );
  }
  if (settings?.provider === "email") {
    return (
      <>
        <SettingsSummaryRow
          label="SMTP"
          value={settings.email_host ? `${settings.email_host}:${settings.email_port}` : "(미설정)"}
          mono
        />
        <SettingsSummaryRow label="보안" value={settings.email_security} />
        <SettingsSummaryRow label="SMTP 계정" value={settings.email_username || "(미설정)"} mono />
        <SettingsSummaryRow label="비밀번호" value={settings.email_password_configured ? "설정됨" : "(미설정)"} />
        <SettingsSummaryRow label="From" value={settings.email_from || "(미설정)"} mono />
        <SettingsSummaryRow
          label="Recipients"
          value={settings.email_recipients.length > 0 ? settings.email_recipients.join(", ") : "(미설정)"}
          mono
        />
      </>
    );
  }
  if (settings?.provider === "pagerduty") {
    return (
      <SettingsSummaryRow
        label="Routing Key"
        value={settings.pagerduty_routing_key_configured ? "설정됨" : "(미설정)"}
      />
    );
  }
  return <SettingsSummaryRow label="Webhook URL" value={settings?.webhook_url || "(미설정)"} mono />;
}
