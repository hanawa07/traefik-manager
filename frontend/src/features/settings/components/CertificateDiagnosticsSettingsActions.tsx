import { Save, X } from "lucide-react";

import { SettingsActionRow } from "@/features/settings/components/SettingsCardPrimitives";

interface CertificateDiagnosticsSettingsActionsProps {
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function CertificateDiagnosticsSettingsActions({
  isSaving,
  onSave,
  onCancel,
}: CertificateDiagnosticsSettingsActionsProps) {
  return (
    <SettingsActionRow>
      <button
        type="button"
        className="btn-primary flex items-center gap-1.5 py-1.5 text-xs"
        onClick={onSave}
        disabled={isSaving}
      >
        <Save className="w-3.5 h-3.5" />
        {isSaving ? "저장 중..." : "저장"}
      </button>
      <button
        type="button"
        className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs"
        onClick={onCancel}
      >
        <X className="w-3.5 h-3.5" /> 취소
      </button>
    </SettingsActionRow>
  );
}
