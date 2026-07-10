import type { Dispatch, SetStateAction } from "react";

import type {
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { SECURITY_ALERT_PROVIDER_OPTIONS } from "@/features/settings/lib/settingsDefaults";
import { SecurityAlertSettingsEditForm } from "@/features/settings/components/SecurityAlertSettingsEditForm";
import { SecurityAlertSettingsSummary } from "@/features/settings/components/SecurityAlertSettingsSummary";

interface SecurityAlertSettingsCardBodyProps {
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
  onSave: () => void;
  onCancel: () => void;
  onTest: () => void;
  onRetrySecurityDelivery: () => void;
  onRetryChangeDelivery: () => void;
  onFormChange: Dispatch<SetStateAction<SecurityAlertSettingsInput>>;
}

export function SecurityAlertSettingsCardBody({
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
  onSave,
  onCancel,
  onTest,
  onRetrySecurityDelivery,
  onRetryChangeDelivery,
  onFormChange,
}: SecurityAlertSettingsCardBodyProps) {
  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />;
  }

  if (isEditing) {
    return (
      <SecurityAlertSettingsEditForm
        settings={settings}
        formValue={formValue}
        errorMessage={errorMessage}
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
        onFormChange={onFormChange}
      />
    );
  }

  const currentProvider =
    SECURITY_ALERT_PROVIDER_OPTIONS.find((option) => option.value === (settings?.provider ?? "generic")) ??
    SECURITY_ALERT_PROVIDER_OPTIONS[0];

  return (
    <SecurityAlertSettingsSummary
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
  );
}
