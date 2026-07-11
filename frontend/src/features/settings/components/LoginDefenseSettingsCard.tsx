import type { Dispatch, SetStateAction } from "react";
import { ShieldCheck } from "lucide-react";

import type { LoginDefenseSettingsStatus } from "@/features/settings/api/settingsApi";
import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";
import type { LoginDefenseForm } from "@/features/settings/lib/settingsDefaults";
import { LoginDefenseSettingsEditForm } from "./LoginDefenseSettingsEditForm";
import { LoginDefenseSettingsSummary } from "./LoginDefenseSettingsSummary";

interface LoginDefenseSettingsCardProps {
  canManage: boolean;
  isLoading: boolean;
  isEditing: boolean;
  settings?: LoginDefenseSettingsStatus;
  formValue: LoginDefenseForm;
  errorMessage: string;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onFormChange: Dispatch<SetStateAction<LoginDefenseForm>>;
}

export function LoginDefenseSettingsCard({
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
}: LoginDefenseSettingsCardProps) {
  return (
    <div className="card p-6 h-full order-4">
      <SettingsCardHeader
        icon={<ShieldCheck className="w-5 h-5 text-amber-600" />}
        title="로그인 보안 방어"
        description={
          "사용자별 계정 잠금은 항상 유지하고, 반복 실패 IP 자동 차단과 " +
          "선택형 Turnstile 로그인 검증을 함께 조정합니다."
        }
        canEdit={canManage && !isEditing && !isLoading}
        onEdit={onEdit}
      />

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
      ) : isEditing ? (
        <LoginDefenseSettingsEditForm
          settings={settings}
          formValue={formValue}
          errorMessage={errorMessage}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={onCancel}
          onFormChange={onFormChange}
        />
      ) : (
        <LoginDefenseSettingsSummary settings={settings} />
      )}
    </div>
  );
}
