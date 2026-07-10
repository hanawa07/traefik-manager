import type { Dispatch, SetStateAction } from "react";
import { Bug } from "lucide-react";

import type {
  TraefikDashboardSettingsInput,
  TraefikDashboardSettingsStatus,
} from "@/features/settings/api/settingsApi";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";

import { TraefikDashboardSettingsForm } from "./TraefikDashboardSettingsForm";
import { TraefikDashboardSettingsSummary } from "./TraefikDashboardSettingsSummary";

interface TraefikDashboardSettingsCardProps {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  settings?: TraefikDashboardSettingsStatus;
  formValue: TraefikDashboardSettingsInput;
  errorMessage: string;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: Dispatch<SetStateAction<TraefikDashboardSettingsInput>>;
}

export function TraefikDashboardSettingsCard({
  canManage,
  isLoading,
  isEditing,
  settings,
  formValue,
  errorMessage,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onFormChange,
}: TraefikDashboardSettingsCardProps) {
  return (
    <div className="card p-6 h-full order-7">
      <SettingsCardHeader
        icon={<Bug className="w-5 h-5 text-violet-600" />}
        title="Traefik 디버그 대시보드"
        description={
          "내장 Traefik dashboard를 필요할 때만 공개 도메인으로 노출합니다. " +
          "기본적으로는 비공개로 두고, 디버깅이 끝나면 다시 끄는 것을 권장합니다."
        }
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isEditing ? (
        <TraefikDashboardSettingsForm
          formValue={formValue}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onFormChange={onFormChange}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : (
        <TraefikDashboardSettingsSummary settings={settings} />
      )}
    </div>
  );
}
