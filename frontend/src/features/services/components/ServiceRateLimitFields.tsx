import type { UseFormRegister } from "react-hook-form";

import type { ServiceFormData } from "./serviceFormSchema";

interface ServiceRateLimitFieldsProps {
  register: UseFormRegister<ServiceFormData>;
  rateLimitEnabled: boolean | undefined;
}

export default function ServiceRateLimitFields({
  register,
  rateLimitEnabled,
}: ServiceRateLimitFieldsProps) {
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded accent-blue-600"
          {...register("rate_limit_enabled")}
        />
        <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Rate Limit 활성화</span>
      </label>

      {rateLimitEnabled ? (
        <div className="grid grid-cols-1 gap-3 pl-1 sm:grid-cols-2">
          <input
            type="number"
            className="input"
            placeholder="초당 평균"
            {...register("rate_limit_average")}
          />
          <input
            type="number"
            className="input"
            placeholder="순간 허용"
            {...register("rate_limit_burst")}
          />
        </div>
      ) : null}
    </div>
  );
}
