import { useBackupExportAction } from "@/features/settings/hooks/useBackupExportAction";
import { useBackupImportActions } from "@/features/settings/hooks/useBackupImportActions";

export function useBackupRestoreSettings(canManage: boolean) {
  const backupExport = useBackupExportAction();
  const backupImport = useBackupImportActions(canManage);

  return {
    ...backupImport,
    ...backupExport,
  };
}
