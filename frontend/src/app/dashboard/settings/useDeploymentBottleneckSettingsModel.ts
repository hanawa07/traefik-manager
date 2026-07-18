import { useState } from "react";

import { useDeploymentInfo } from "@/features/deployment/hooks/useDeploymentInfo";
import { buildDeploymentBottleneckPreview } from "@/features/deployment/lib/deploymentBottleneckPreview";
import type { DeploymentBottleneckSettings } from "@/features/settings/api/settingsApi";
import {
  useCleanupDeploymentBottleneckEvents,
  useDeploymentBottleneckSettings,
  usePreviewDeploymentBottleneckEventCleanup,
  useUpdateDeploymentBottleneckSettings,
} from "@/features/settings/hooks/useSettings";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";

const DEFAULT_SETTINGS: DeploymentBottleneckSettings = {
  threshold_ms: 60_000,
  consecutive_count: 3,
  event_retention_days: 90,
};

export function useDeploymentBottleneckSettingsModel(
  canManage: boolean,
  timezone: string | undefined,
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
  const previewCleanup = usePreviewDeploymentBottleneckEventCleanup();
  const cleanupEvents = useCleanupDeploymentBottleneckEvents();
  const previewSettings = isEditing ? formValue : settings ?? DEFAULT_SETTINGS;
  const preview = deploymentInfo
    ? buildDeploymentBottleneckPreview(
        deploymentInfo.deployment_history,
        previewSettings.threshold_ms,
        previewSettings.consecutive_count,
      )
    : undefined;
  const alert = deploymentInfo?.deployment_bottleneck_alert;
  const hostSettings = alert
    ? {
        threshold_ms: alert.effective_threshold_ms,
        consecutive_count: alert.effective_consecutive_count,
        event_retention_days: alert.effective_event_retention_days,
      }
    : undefined;
  const hostOverrideLabels = alert
    ? [
        ...(alert.threshold_source === "environment" ? ["단계 소요 기준"] : []),
        ...(alert.consecutive_source === "environment" ? ["연속 감지 기준"] : []),
        ...(alert.event_retention_source === "environment" ? ["이벤트 보관 기간"] : []),
      ]
    : [];
  const hostPreview = deploymentInfo && hostSettings
    ? hostSettings.threshold_ms === previewSettings.threshold_ms
      && hostSettings.consecutive_count === previewSettings.consecutive_count
      ? preview
      : buildDeploymentBottleneckPreview(
          deploymentInfo.deployment_history,
          hostSettings.threshold_ms,
          hostSettings.consecutive_count,
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
      detail: `${formValue.threshold_ms / 1000}초 초과가 ${formValue.consecutive_count}회 연속되면 알림을 요청하고 이벤트는 ${formValue.event_retention_days}일 보관합니다.`,
    });
    setIsEditing(false);
  };

  const handleCleanup = async () => {
    let cleanupPreview;
    try {
      cleanupPreview = await previewCleanup.mutateAsync();
    } catch (error) {
      onToast({
        tone: "error",
        message: "배포 병목 이벤트 정리 확인 실패",
        detail: getSettingsModelErrorMessage(error, "삭제 예정 이벤트를 확인하지 못했습니다"),
      });
      return;
    }
    if (cleanupPreview.deleted_count === 0) {
      onToast({
        tone: "warning",
        message: "정리할 배포 병목 이벤트 없음",
        detail: `적용 기간 ${cleanupPreview.retention_days}일 · 현재 ${cleanupPreview.retained_event_count}건 보관 중입니다.`,
      });
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `보관 기간 ${cleanupPreview.retention_days}일을 적용하면 ${cleanupPreview.deleted_count}건을 삭제하고 ${cleanupPreview.retained_event_count}건을 남깁니다. 계속하시겠습니까?`,
      )
    ) {
      return;
    }
    try {
      const result = await cleanupEvents.mutateAsync();
      onToast({
        tone: "success",
        message: "배포 병목 이벤트 정리 완료",
        detail: `${result.deleted_count}건 삭제 · ${result.retained_event_count}건 보관 · `
          + `적용 기간 ${result.retention_days}일`,
      });
    } catch (error) {
      onToast({
        tone: "error",
        message: "배포 병목 이벤트 정리 실패",
        detail: getSettingsModelErrorMessage(error, "보관 기간 정리를 수행하지 못했습니다"),
      });
    }
  };

  return {
    canManage,
    formValue,
    hostPreview,
    hostOverrideLabels,
    hostSettings,
    isEditing,
    isCleaning: previewCleanup.isPending || cleanupEvents.isPending,
    isLoading,
    isSaving: updateSettings.isPending,
    isPreviewError,
    isPreviewLoading,
    onCancel: () => setIsEditing(false),
    onCleanup: handleCleanup,
    onEdit: handleEdit,
    onFormChange: setFormValue,
    onSave: handleSave,
    preview,
    settings,
    retainedEventCount: alert?.retained_event_count,
    oldestEventAt: alert?.oldest_event_at,
    newestEventAt: alert?.newest_event_at,
    timezone,
  };
}
