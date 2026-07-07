import { useState } from "react";

import type { CloudflareZoneInput } from "@/features/settings/api/settingsApi";
import {
  buildCloudflareZoneFormValue,
} from "@/features/settings/hooks/cloudflareDnsSettingsModelHelpers";
import {
  useCloudflareStatus,
  useSettingsTestHistory,
  useUpdateCloudflareSettings,
} from "@/features/settings/hooks/useSettings";
import { useCloudflareDnsActionResults } from "./useCloudflareDnsActionResults";
import { createDefaultCloudflareZoneForm } from "@/features/settings/lib/settingsDefaults";
import { getApiErrorDetail } from "@/features/settings/lib/settingsErrors";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";

export function useCloudflareDnsSettingsSection(
  timezone: string | undefined,
  onToast: (notice: ToastNoticeValue) => void,
) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState<CloudflareZoneInput[]>([createDefaultCloudflareZoneForm()]);

  const { data: status, isLoading } = useCloudflareStatus();
  const { data: testHistory, isLoading: isHistoryLoading } = useSettingsTestHistory();
  const updateCloudflare = useUpdateCloudflareSettings();
  const cloudflareActions = useCloudflareDnsActionResults();

  const handleEdit = () => {
    setFormValue(buildCloudflareZoneFormValue(status));
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await updateCloudflare.mutateAsync({ zones: formValue });
      cloudflareActions.resetActionResults();
      onToast({
        tone: "success",
        message: "Cloudflare DNS 설정 저장 완료",
        detail: `${formValue.length}개 zone 설정이 저장됐습니다.`,
      });
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getApiErrorDetail(error, "Cloudflare 설정 저장에 실패했습니다"));
    }
  };

  return {
    isLoading,
    isEditing,
    status,
    formValue,
    errorMessage,
    isSaving: updateCloudflare.isPending,
    isTesting: cloudflareActions.isTesting,
    isDiagnosing: cloudflareActions.isDiagnosing,
    isReconciling: cloudflareActions.isReconciling,
    isHistoryLoading,
    timezone,
    testHistory: testHistory?.cloudflare,
    driftHistory: testHistory?.cloudflare_drift,
    reconcileHistory: testHistory?.cloudflare_reconcile,
    testResult: cloudflareActions.testResult,
    driftResult: cloudflareActions.driftResult,
    reconcileResult: cloudflareActions.reconcileResult,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: () => setIsEditing(false),
    onTest: cloudflareActions.onTest,
    onDiagnose: cloudflareActions.onDiagnose,
    onReconcile: cloudflareActions.onReconcile,
    onFormChange: setFormValue,
  };
}
