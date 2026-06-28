import type { Dispatch, SetStateAction } from "react";
import { Cloud } from "lucide-react";

import type {
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";
import { SecurityAlertSettingsEditForm } from "@/features/settings/components/SecurityAlertSettingsEditForm";
import { SecurityAlertSettingsSummary } from "@/features/settings/components/SecurityAlertSettingsSummary";
import { SECURITY_ALERT_PROVIDER_OPTIONS } from "@/features/settings/lib/settingsDefaults";

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
  const currentProvider =
    SECURITY_ALERT_PROVIDER_OPTIONS.find((option) => option.value === (settings?.provider ?? "generic")) ??
    SECURITY_ALERT_PROVIDER_OPTIONS[0];

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
        <SecurityAlertSettingsEditForm
          settings={settings}
          formValue={formValue}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={onCancel}
          onFormChange={onFormChange}
        />
      ) : (
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
      )}
    </div>
  );
}
