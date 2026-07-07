import { useState } from "react";

import {
  useUpdateUpstreamSecuritySettings,
  useUpstreamSecuritySettings,
} from "@/features/settings/hooks/useSettings";
import { createDefaultUpstreamSecurityForm } from "@/features/settings/lib/settingsDefaults";
import { parseMultivalueText } from "@/features/settings/lib/settingsFormHelpers";
import type { ToastNoticeValue } from "@/shared/components/ToastNotice";

export function useUpstreamSecuritySettingsModel(canManage: boolean, onToast: (notice: ToastNoticeValue) => void) {
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState(createDefaultUpstreamSecurityForm());
  const { data: settings, isLoading } = useUpstreamSecuritySettings();
  const updateUpstreamSecurity = useUpdateUpstreamSecuritySettings();

  const handleEdit = () => {
    setFormValue({
      dns_strict_mode: settings?.dns_strict_mode ?? false,
      allowlist_enabled: settings?.allowlist_enabled ?? false,
      allowed_domain_suffixes: settings?.allowed_domain_suffixes ?? [],
      allowed_domain_suffixes_text: (settings?.allowed_domain_suffixes ?? []).join("\n"),
      allow_docker_service_names: settings?.allow_docker_service_names ?? true,
      allow_private_networks: settings?.allow_private_networks ?? true,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateUpstreamSecurity.mutateAsync({
      dns_strict_mode: formValue.dns_strict_mode,
      allowlist_enabled: formValue.allowlist_enabled,
      allowed_domain_suffixes: parseMultivalueText(formValue.allowed_domain_suffixes_text),
      allow_docker_service_names: formValue.allow_docker_service_names,
      allow_private_networks: formValue.allow_private_networks,
    });
    onToast({
      tone: "success",
      message: "업스트림 보안 설정 저장 완료",
      detail: formValue.dns_strict_mode ? "DNS strict mode가 활성화됐습니다." : "DNS strict mode가 비활성화됐습니다.",
    });
    setIsEditing(false);
  };

  return {
    canManage,
    isLoading,
    isEditing,
    settings,
    formValue,
    isSaving: updateUpstreamSecurity.isPending,
    onEdit: handleEdit,
    onSave: handleSave,
    onCancel: () => setIsEditing(false),
    onFormChange: setFormValue,
  };
}
