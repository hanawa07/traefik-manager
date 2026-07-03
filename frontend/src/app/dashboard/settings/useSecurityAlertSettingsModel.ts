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
import {
  buildSecurityAlertSettingsPayload,
  createSecurityAlertFormFromSettings,
} from "./securityAlertSettingsModelHelpers";
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
    setFormValue(createSecurityAlertFormFromSettings(settings));
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await updateSecurityAlert.mutateAsync(buildSecurityAlertSettingsPayload(formValue));
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
