import { Plus, Users } from "lucide-react";

import { SettingsCardHeader } from "@/features/settings/components/SettingsCardPrimitives";

interface UserManagementHeaderProps {
  onCreate: () => void;
}

export function UserManagementHeader({ onCreate }: UserManagementHeaderProps) {
  return (
    <SettingsCardHeader
      icon={<Users className="h-5 w-5 text-emerald-600" />}
      title="사용자 관리"
      description="관리자와 뷰어 계정을 생성, 수정, 비활성화합니다."
      action={
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2 py-1.5 text-xs"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" />
          사용자 추가
        </button>
      }
    />
  );
}
