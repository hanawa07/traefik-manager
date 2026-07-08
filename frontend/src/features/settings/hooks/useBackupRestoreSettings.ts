import { useBackupExportAction } from "@/features/settings/hooks/useBackupExportAction";
import { useBackupImportActions } from "@/features/settings/hooks/useBackupImportActions";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";

export function useBackupRestoreSettings(canManage: boolean, onToast: (notice: ToastNoticeValue) => void) {
  const backupExport = useBackupExportAction(onToast);
  const backupImport = useBackupImportActions(canManage, onToast);

  return {
    ...backupImport,
    ...backupExport,
  };
}
