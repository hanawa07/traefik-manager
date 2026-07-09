import type { UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import type { ServiceFormData } from "./serviceFormSchema";

export interface ServiceBasicAuthField {
  id: string;
}

interface ServiceBasicAuthUsersProps {
  register: UseFormRegister<ServiceFormData>;
  basicAuthFields: ServiceBasicAuthField[];
  onAddBasicAuthUser: () => void;
  onRemoveBasicAuthUser: (index: number) => void;
}

export default function ServiceBasicAuthUsers({
  register,
  basicAuthFields,
  onAddBasicAuthUser,
  onRemoveBasicAuthUser,
}: ServiceBasicAuthUsersProps) {
  return (
    <div className="animate-in fade-in space-y-3 slide-in-from-top-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Basic Auth 사용자</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            입력한 비밀번호는 서버에서 htpasswd 형식으로 해시 저장됩니다
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex w-full shrink-0 items-center justify-center gap-1.5 py-1.5 text-sm sm:w-auto"
          onClick={onAddBasicAuthUser}
        >
          <Plus className="h-3.5 w-3.5" />
          사용자 추가
        </button>
      </div>

      <div className="space-y-2">
        {basicAuthFields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              className="input"
              placeholder="사용자 이름"
              {...register(`basic_auth_credentials.${index}.username`)}
            />
            <input
              type="password"
              className="input"
              placeholder="비밀번호"
              {...register(`basic_auth_credentials.${index}.password`)}
            />
            <button
              type="button"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              onClick={() => onRemoveBasicAuthUser(index)}
              disabled={basicAuthFields.length === 1}
              title="사용자 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
