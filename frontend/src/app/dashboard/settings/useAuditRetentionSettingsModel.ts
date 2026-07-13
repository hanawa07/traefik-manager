import { useState } from "react";

import type { AuditRetentionSettingsInput } from "@/features/settings/api/settingsApi";
import {
  useAuditRetentionSettings,
  useRunAuditRetentionCleanup,
  useUpdateAuditRetentionSettings,
} from "@/features/settings/hooks/useSettings";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";
import { getSettingsModelErrorMessage } from "./settingsModelErrors";

const DEFAULT_FORM: AuditRetentionSettingsInput = {
  retention_days: 365,
  archive_enabled: true,
};

export function useAuditRetentionSettingsModel(
  canManage: boolean,
  timezone: string | undefined,
  onToast: (notice: ToastNoticeValue) => void,
) {
  const query = useAuditRetentionSettings();
  const update = useUpdateAuditRetentionSettings();
  const cleanup = useRunAuditRetentionCleanup();
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(DEFAULT_FORM);
  const [errorMessage, setErrorMessage] = useState("");

  const handleEdit = () => {
    setFormValue({
      retention_days: query.data?.retention_days ?? DEFAULT_FORM.retention_days,
      archive_enabled: query.data?.archive_enabled ?? DEFAULT_FORM.archive_enabled,
    });
    setErrorMessage("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setErrorMessage("");
    try {
      await update.mutateAsync(formValue);
      onToast({
        tone: "success",
        message: "감사 로그 보존 정책 저장 완료",
        detail: `${formValue.retention_days}일이 지난 로그를 ${formValue.archive_enabled ? "아카이브 후 " : ""}정리합니다.`,
      });
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(getSettingsModelErrorMessage(error, "감사 로그 보존 정책 저장에 실패했습니다"));
    }
  };

  const handleCleanup = async () => {
    try {
      const result = await cleanup.mutateAsync();
      onToast({
        tone: "success",
        message: "감사 로그 정리 완료",
        detail: `${result.last_archived_count}건 아카이브, ${result.last_deleted_count}건 삭제했습니다.`,
      });
    } catch (error) {
      onToast({
        tone: "error",
        message: "감사 로그 정리 실패",
        detail: getSettingsModelErrorMessage(error, "보존 정책을 실행하지 못했습니다"),
      });
    }
  };

  return {
    canManage,
    timezone,
    isLoading: query.isLoading,
    isError: query.isError,
    isEditing,
    status: query.data,
    formValue,
    errorMessage,
    isSaving: update.isPending,
    isCleaning: cleanup.isPending,
    onEdit: handleEdit,
    onSave: handleSave,
    onCleanup: handleCleanup,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
