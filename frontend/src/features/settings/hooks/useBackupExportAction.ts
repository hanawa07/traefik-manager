import { useState } from "react";

import { useExportBackup } from "@/features/settings/hooks/useSettings";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";

export function useBackupExportAction(onToast: (notice: ToastNoticeValue) => void) {
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
      const filename = `traefik-manager-backup-${now}.json`;

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onToast({
        tone: "success",
        message: "백업 내보내기 완료",
        detail: filename,
      });
    } catch {
      setExportErrorMessage("백업 내보내기에 실패했습니다");
      onToast({
        tone: "error",
        message: "백업 내보내기 실패",
        detail: "설정 JSON 파일을 생성하지 못했습니다.",
      });
    }
  };

  return {
    exportErrorMessage,
    isExporting: exportBackup.isPending,
    onExport: handleExport,
  };
}
