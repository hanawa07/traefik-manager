import type { Dispatch, SetStateAction } from "react";
import { Cloud } from "lucide-react";

import type {
  SecurityAlertSettingsInput,
  SecurityAlertSettingsStatus,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";
import { SecurityAlertSettingsCardBody } from "@/features/settings/components/SecurityAlertSettingsCardBody";

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
  isRetryingDelivery: boolean;
  retryTargetAuditId: string | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTest: () => void;
  onRetrySecurityDelivery: (auditLogId?: string) => void;
  onRetryChangeDelivery: (auditLogId?: string) => void;
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
  isRetryingDelivery,
  retryTargetAuditId,
  onEdit,
  onSave,
  onCancel,
  onTest,
  onRetrySecurityDelivery,
  onRetryChangeDelivery,
  onFormChange,
}: SecurityAlertSettingsCardProps) {
  return (
    <div className="card p-6 h-full order-9" data-testid="security-alert-settings-card">
      <SettingsCardHeader
        icon={<Cloud className="w-5 h-5 text-sky-600" />}
        title="보안 알림"
        description="보안 이벤트와 운영 변경 이벤트를 외부 채널로 전달합니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      <SecurityAlertSettingsCardBody
        canManage={canManage}
        isLoading={isLoading}
        isEditing={isEditing}
        settings={settings}
        formValue={formValue}
        errorMessage={errorMessage}
        isSaving={isSaving}
        isTesting={isTesting}
        isHistoryLoading={isHistoryLoading}
        displayTimezone={displayTimezone}
        testResult={testResult}
        securityRetryResult={securityRetryResult}
        changeRetryResult={changeRetryResult}
        securityTestHistory={securityTestHistory}
        securityDeliveryHistory={securityDeliveryHistory}
        changeDeliveryHistory={changeDeliveryHistory}
        isRetryingDelivery={isRetryingDelivery}
        retryTargetAuditId={retryTargetAuditId}
        onSave={onSave}
        onCancel={onCancel}
        onTest={onTest}
        onRetrySecurityDelivery={onRetrySecurityDelivery}
        onRetryChangeDelivery={onRetryChangeDelivery}
        onFormChange={onFormChange}
      />
    </div>
  );
}
