import { useState } from "react";

import { useExportBackup } from "@/features/settings/hooks/useSettings";

export function useBackupExportAction() {
  const [exportErrorMessage, setExportErrorMessage] = useState("");
  const exportBackup = useExportBackup();

  const handleExport = async () => {
    setExportErrorMessage("");
    try {
      const data = await exportBackup.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const now = new Date().toISOString().replace(/[:.]/g, "-");

      link.href = url;
      link.download = `traefik-manager-backup-${now}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportErrorMessage("백업 내보내기에 실패했습니다");
    }
  };

  return {
    exportErrorMessage,
    isExporting: exportBackup.isPending,
    onExport: handleExport,
  };
}
