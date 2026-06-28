import type { Dispatch, SetStateAction } from "react";
import { Cloud } from "lucide-react";

import type {
  CloudflareDriftCheckResult,
  CloudflareSettingsStatus,
  CloudflareZoneInput,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { CloudflareDnsEditForm } from "@/features/settings/components/CloudflareDnsEditForm";
import { CloudflareDnsSummary } from "@/features/settings/components/CloudflareDnsSummary";
import { CloudflarePermissionNote } from "@/features/settings/components/CloudflarePermissionNote";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";

interface CloudflareDnsSettingsCardProps {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  status?: CloudflareSettingsStatus;
  formValue: CloudflareZoneInput[];
  errorMessage: string;
  isSaving: boolean;
  isTesting: boolean;
  isDiagnosing: boolean;
  isReconciling: boolean;
  isHistoryLoading: boolean;
  timezone?: string;
  testHistory?: SettingsTestHistoryItem | null;
  driftHistory?: SettingsTestHistoryItem | null;
  reconcileHistory?: SettingsTestHistoryItem | null;
  testResult: SettingsActionTestResult | null;
  driftResult: CloudflareDriftCheckResult | null;
  reconcileResult: SettingsActionTestResult | null;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTest: () => void;
  onDiagnose: () => void;
  onReconcile: () => void;
  onFormChange: Dispatch<SetStateAction<CloudflareZoneInput[]>>;
}

export function CloudflareDnsSettingsCard({
  canManage,
  isLoading,
  isEditing,
  status,
  formValue,
  errorMessage,
  isSaving,
  isTesting,
  isDiagnosing,
  isReconciling,
  isHistoryLoading,
  timezone,
  testHistory,
  driftHistory,
  reconcileHistory,
  testResult,
  driftResult,
  reconcileResult,
  onEdit,
  onSave,
  onCancel,
  onTest,
  onDiagnose,
  onReconcile,
  onFormChange,
}: CloudflareDnsSettingsCardProps) {
  return (
    <div className="card p-6 h-full order-10">
      <SettingsCardHeader
        icon={<Cloud className="w-5 h-5 text-blue-600" />}
        title="Cloudflare DNS 자동 연동"
        description="서비스 추가/삭제 시 Cloudflare DNS A 레코드를 자동으로 생성/삭제합니다. 이미 DNS가 수동으로 설정되어 있다면 사용하지 않아도 됩니다."
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
      ) : isEditing ? (
        <CloudflareDnsEditForm
          zones={formValue}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={onCancel}
          onFormChange={onFormChange}
        />
      ) : (
        <CloudflareDnsSummary
          canManage={canManage}
          status={status}
          isTesting={isTesting}
          isDiagnosing={isDiagnosing}
          isReconciling={isReconciling}
          isHistoryLoading={isHistoryLoading}
          timezone={timezone}
          testHistory={testHistory}
          driftHistory={driftHistory}
          reconcileHistory={reconcileHistory}
          testResult={testResult}
          driftResult={driftResult}
          reconcileResult={reconcileResult}
          onTest={onTest}
          onDiagnose={onDiagnose}
          onReconcile={onReconcile}
        />
      )}

      <CloudflarePermissionNote />
    </div>
  );
}
