import { useState } from "react";

import { useDeploymentInfo } from "@/features/deployment/hooks/useDeploymentInfo";
import { buildDeploymentBottleneckPreview } from "@/features/deployment/lib/deploymentBottleneckPreview";
import type { DeploymentBottleneckSettings } from "@/features/settings/api/settingsApi";
import {
  useDeploymentBottleneckSettings,
  useUpdateDeploymentBottleneckSettings,
} from "@/features/settings/hooks/useSettings";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";

const DEFAULT_SETTINGS: DeploymentBottleneckSettings = {
  threshold_ms: 60_000,
  consecutive_count: 3,
};

export function useDeploymentBottleneckSettingsModel(
  canManage: boolean,
  onToast: (notice: ToastNoticeValue) => void,
) {
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(DEFAULT_SETTINGS);
  const { data: settings, isLoading } = useDeploymentBottleneckSettings();
  const {
    data: deploymentInfo,
    isError: isPreviewError,
    isLoading: isPreviewLoading,
  } = useDeploymentInfo();
  const updateSettings = useUpdateDeploymentBottleneckSettings();
  const previewSettings = isEditing ? formValue : settings ?? DEFAULT_SETTINGS;
  const preview = deploymentInfo
    ? buildDeploymentBottleneckPreview(
        deploymentInfo.deployment_history,
        previewSettings.threshold_ms,
        previewSettings.consecutive_count,
      )
    : undefined;

  const handleEdit = () => {
    setFormValue(settings ?? DEFAULT_SETTINGS);
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync(formValue);
    onToast({
      tone: "success",
      message: "배포 병목 운영 알림 설정 저장 완료",
      detail: `${formValue.threshold_ms / 1000}초 초과가 ${formValue.consecutive_count}회 연속되면 알림을 요청합니다.`,
    });
    setIsEditing(false);
  };

  return {
    canManage,
    formValue,
    isEditing,
    isLoading,
    isSaving: updateSettings.isPending,
    isPreviewError,
    isPreviewLoading,
    onCancel: () => setIsEditing(false),
    onEdit: handleEdit,
    onFormChange: setFormValue,
    onSave: handleSave,
    preview,
    settings,
  };
}
