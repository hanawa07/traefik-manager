import { useState } from "react";

import type { AuditRetentionSettingsInput } from "@/features/settings/api/settingsApi";
import {
  useAuditArchives,
  useAuditRetentionSettings,
  useRestoreAuditArchive,
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
  const archives = useAuditArchives(canManage);
  const restore = useRestoreAuditArchive();
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
      await archives.refetch();
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

  const handleRestore = async (filename: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `${filename}을 복원하시겠습니까? 이미 존재하는 감사 로그는 변경하지 않습니다.`,
      )
    ) {
      return;
    }
    try {
      const result = await restore.mutateAsync(filename);
      onToast({
        tone: "success",
        message: "감사 로그 아카이브 복원 완료",
        detail: `${result.restored_count}건 복원, ${result.skipped_count}건 건너뛰었습니다.`,
      });
    } catch (error) {
      onToast({
        tone: "error",
        message: "감사 로그 아카이브 복원 실패",
        detail: getSettingsModelErrorMessage(error, "아카이브를 복원하지 못했습니다"),
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
    archives: archives.data?.archives,
    isArchivesLoading: archives.isLoading,
    isArchivesError: archives.isError,
    restoringFilename: restore.isPending ? restore.variables ?? null : null,
    onEdit: handleEdit,
    onSave: handleSave,
    onCleanup: handleCleanup,
    onRestore: handleRestore,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
