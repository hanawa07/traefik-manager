import type { Dispatch, SetStateAction } from "react";
import { Cloud } from "lucide-react";

import ToastNotice, { type ToastNoticeValue } from "@/shared/components/ToastNotice";
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
  saveToastNotice: ToastNoticeValue | null;
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
  onDismissSaveToast: () => void;
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
  saveToastNotice,
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
  onDismissSaveToast,
  onFormChange,
}: SecurityAlertSettingsCardProps) {
  return (
    <div className="card p-6 h-full order-9">
      <ToastNotice notice={saveToastNotice} onClose={onDismissSaveToast} />
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
        isRetryingSecurityDelivery={isRetryingSecurityDelivery}
        isRetryingChangeDelivery={isRetryingChangeDelivery}
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
