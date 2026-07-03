import { useState } from "react";

import type {
  CloudflareDriftCheckResult,
  CloudflareZoneInput,
  SettingsActionTestResult,
} from "@/features/settings/api/settingsApi";
import {
  buildCloudflareActionFailureResult,
  buildCloudflareDriftFailureResult,
  buildCloudflareZoneFormValue,
} from "@/features/settings/hooks/cloudflareDnsSettingsModelHelpers";
import {
  useCloudflareStatus,
  useDiagnoseCloudflareDnsDrift,
  useReconcileCloudflareDns,
  useSettingsTestHistory,
  useTestCloudflareConnection,
  useUpdateCloudflareSettings,
} from "@/features/settings/hooks/useSettings";
import { createDefaultCloudflareZoneForm } from "@/features/settings/lib/settingsDefaults";
import { getApiErrorDetail } from "@/features/settings/lib/settingsErrors";

export function useCloudflareDnsSettingsSection(timezone?: string) {
  const [errorMessage, setErrorMessage] = useState("");
  const [testResult, setTestResult] = useState<SettingsActionTestResult | null>(null);
  const [driftResult, setDriftResult] = useState<CloudflareDriftCheckResult | null>(null);
  const [reconcileResult, setReconcileResult] = useState<SettingsActionTestResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState<CloudflareZoneInput[]>([createDefaultCloudflareZoneForm()]);

  const { data: status, isLoading } = useCloudflareStatus();
  const { data: testHistory, isLoading: isHistoryLoading } = useSettingsTestHistory();
  const updateCloudflare = useUpdateCloudflareSettings();
  const testCloudflareConnection = useTestCloudflareConnection();
  const diagnoseCloudflareDnsDrift = useDiagnoseCloudflareDnsDrift();
  const reconcileCloudflareDns = useReconcileCloudflareDns();

  const handleEdit = () => {
    setFormValue(buildCloudflareZoneFormValue(status));
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await updateCloudflare.mutateAsync({ zones: formValue });
      setTestResult(null);
      setDriftResult(null);
      setReconcileResult(null);
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getApiErrorDetail(error, "Cloudflare 설정 저장에 실패했습니다"));
    }
  };

  const handleTest = async () => {
    try {
      setTestResult(await testCloudflareConnection.mutateAsync());
    } catch (error) {
      setTestResult(
        buildCloudflareActionFailureResult(error, "Cloudflare 연결 테스트에 실패했습니다"),
      );
    }
  };

  const handleReconcile = async () => {
    try {
      setReconcileResult(await reconcileCloudflareDns.mutateAsync());
    } catch (error) {
      setReconcileResult(
        buildCloudflareActionFailureResult(error, "Cloudflare DNS 재동기화에 실패했습니다"),
      );
    }
  };

  const handleDiagnose = async () => {
    try {
      setDriftResult(await diagnoseCloudflareDnsDrift.mutateAsync());
    } catch (error) {
      setDriftResult(buildCloudflareDriftFailureResult(error));
    }
  };

  return {
    isLoading,
    isEditing,
    status,
    formValue,
    errorMessage,
    isSaving: updateCloudflare.isPending,
    isTesting: testCloudflareConnection.isPending,
    isDiagnosing: diagnoseCloudflareDnsDrift.isPending,
    isReconciling: reconcileCloudflareDns.isPending,
    isHistoryLoading,
    timezone,
    testHistory: testHistory?.cloudflare,
    driftHistory: testHistory?.cloudflare_drift,
    reconcileHistory: testHistory?.cloudflare_reconcile,
    testResult,
    driftResult,
    reconcileResult,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: () => setIsEditing(false),
    onTest: handleTest,
    onDiagnose: handleDiagnose,
    onReconcile: handleReconcile,
    onFormChange: setFormValue,
  };
}
