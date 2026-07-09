import type { UseFormRegister } from "react-hook-form";

import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceBasicAuthToggleProps {
  register: UseFormRegister<ServiceFormData>;
  isAnyAuthEnabled: boolean;
}

export default function ServiceBasicAuthToggle({
  register,
  isAnyAuthEnabled,
}: ServiceBasicAuthToggleProps) {
  return (
    <div className="border-t border-gray-50 pt-2 dark:border-slate-800">
      <label
        className={`flex items-center gap-3 ${
          isAnyAuthEnabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <input
          type="checkbox"
          className="h-4 w-4 rounded accent-blue-600"
          disabled={isAnyAuthEnabled}
          {...register("basic_auth_enabled")}
        />
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Basic Auth 활성화</span>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            ForwardAuth 모드에서는 사용할 수 없습니다
          </p>
        </div>
      </label>
    </div>
  );
}
