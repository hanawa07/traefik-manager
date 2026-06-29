import { useState } from "react";

import type { SettingsActionTestResult } from "@/features/settings/api/settingsApi";
import {
  useSecurityAlertSettings,
  useSettingsTestHistory,
  useTestSecurityAlertSettings,
  useUpdateSecurityAlertSettings,
} from "@/features/settings/hooks/useSettings";
import { createDefaultSecurityAlertForm } from "@/features/settings/lib/settingsDefaults";
import { buildActionFailure, getApiErrorDetail } from "@/features/settings/lib/settingsErrors";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";
import { useSettingsAlertRetry } from "./useSettingsAlertRetry";

export function useSecurityAlertSettingsModel(canManage: boolean, displayTimezone: string | undefined) {
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(createDefaultSecurityAlertForm());
  const [errorMessage, setErrorMessage] = useState("");
  const [testResult, setTestResult] = useState<SettingsActionTestResult | null>(null);
  const { data: settings, isLoading } = useSecurityAlertSettings();
  const { data: settingsTestHistory, isLoading: isHistoryLoading } = useSettingsTestHistory();
  const updateSecurityAlert = useUpdateSecurityAlertSettings();
  const testSecurityAlertSettings = useTestSecurityAlertSettings();
  const {
    securityAlertDeliveryRetryResult,
    changeAlertDeliveryRetryResult,
    isRetryingSecurityDelivery,
    isRetryingChangeDelivery,
    retrySecurityDelivery,
    retryChangeDelivery,
  } = useSettingsAlertRetry(settingsTestHistory);

  const handleEdit = () => {
    setFormValue({
      enabled: settings?.enabled ?? false,
      change_alerts_enabled: settings?.change_alerts_enabled ?? false,
      provider: settings?.provider ?? "generic",
      webhook_url: settings?.webhook_url ?? "",
      telegram_bot_token: "",
      telegram_chat_id: settings?.telegram_chat_id ?? "",
      pagerduty_routing_key: "",
      email_host: settings?.email_host ?? "",
      email_port: settings?.email_port ?? 587,
      email_security: settings?.email_security ?? "starttls",
      email_username: settings?.email_username ?? "",
      email_password: "",
      email_from: settings?.email_from ?? "",
      email_recipients: settings?.email_recipients ?? [],
      event_routes: settings?.event_routes ?? createDefaultSecurityAlertForm().event_routes,
      change_event_routes: settings?.change_event_routes ?? createDefaultSecurityAlertForm().change_event_routes,
    });
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await updateSecurityAlert.mutateAsync({
        enabled: formValue.enabled,
        change_alerts_enabled: formValue.change_alerts_enabled,
        provider: formValue.provider,
        webhook_url: formValue.webhook_url.trim(),
        telegram_bot_token: formValue.telegram_bot_token.trim(),
        telegram_chat_id: formValue.telegram_chat_id.trim(),
        pagerduty_routing_key: formValue.pagerduty_routing_key.trim(),
        email_host: formValue.email_host.trim(),
        email_port: formValue.email_port,
        email_security: formValue.email_security,
        email_username: formValue.email_username.trim(),
        email_password: formValue.email_password.trim(),
        email_from: formValue.email_from.trim(),
        email_recipients: formValue.email_recipients,
        event_routes: formValue.event_routes,
        change_event_routes: formValue.change_event_routes,
      });
      setTestResult(null);
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getSettingsModelErrorMessage(error, "보안 알림 설정 저장에 실패했습니다"));
    }
  };

  const handleTest = async () => {
    try {
      setTestResult(await testSecurityAlertSettings.mutateAsync());
    } catch (error) {
      setTestResult(
        buildActionFailure("테스트 보안 알림 전송에 실패했습니다", getApiErrorDetail(error, "요청 처리 중 오류가 발생했습니다")),
      );
    }
  };

  return {
    canManage,
    isLoading,
    isEditing,
    settings,
    formValue,
    errorMessage,
    isSaving: updateSecurityAlert.isPending,
    isTesting: testSecurityAlertSettings.isPending,
    isHistoryLoading,
    displayTimezone,
    testResult,
    securityRetryResult: securityAlertDeliveryRetryResult,
    changeRetryResult: changeAlertDeliveryRetryResult,
    securityTestHistory: settingsTestHistory?.security_alert,
    securityDeliveryHistory: settingsTestHistory?.security_alert_delivery,
    changeDeliveryHistory: settingsTestHistory?.change_alert_delivery,
    isRetryingSecurityDelivery,
    isRetryingChangeDelivery,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: () => setIsEditing(false),
    onTest: handleTest,
    onRetrySecurityDelivery: retrySecurityDelivery,
    onRetryChangeDelivery: retryChangeDelivery,
    onFormChange: setFormValue,
  };
}
