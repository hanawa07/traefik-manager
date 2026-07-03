import type { Dispatch, SetStateAction } from "react";

import type {
  CloudflareDriftCheckResult,
  CloudflareSettingsStatus,
  CloudflareZoneInput,
  SettingsActionTestResult,
  SettingsTestHistoryItem,
} from "@/features/settings/api/settingsApi";
import { CloudflareDnsEditForm } from "@/features/settings/components/CloudflareDnsEditForm";
import { CloudflareDnsSummary } from "@/features/settings/components/CloudflareDnsSummary";

interface CloudflareDnsSettingsCardBodyProps {
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
  onSave: () => void;
  onCancel: () => void;
  onTest: () => void;
  onDiagnose: () => void;
  onReconcile: () => void;
  onFormChange: Dispatch<SetStateAction<CloudflareZoneInput[]>>;
}

export function CloudflareDnsSettingsCardBody({
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
  onSave,
  onCancel,
  onTest,
  onDiagnose,
  onReconcile,
  onFormChange,
}: CloudflareDnsSettingsCardBodyProps) {
  if (isLoading) {
    return <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />;
  }

  if (isEditing) {
    return (
      <CloudflareDnsEditForm
        zones={formValue}
        errorMessage={errorMessage}
        isSaving={isSaving}
        onSave={onSave}
        onCancel={onCancel}
        onFormChange={onFormChange}
      />
    );
  }

  return (
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
  );
}
