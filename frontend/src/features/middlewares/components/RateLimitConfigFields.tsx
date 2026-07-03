import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { MiddlewareFormData } from "./middlewareFormModel";

interface RateLimitConfigFieldsProps {
  register: UseFormRegister<MiddlewareFormData>;
  errors: FieldErrors<MiddlewareFormData>;
}

export function RateLimitConfigFields({ register, errors }: RateLimitConfigFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">
          average <span className="font-normal text-gray-400">(초당 평균 요청 수)</span>
        </label>
        <input type="number" className="input" min={1} placeholder="예: 100" {...register("rate_limit_average")} />
      </div>
      <div>
        <label className="label">
          burst <span className="font-normal text-gray-400">(순간 최대 요청 수)</span>
        </label>
        <input type="number" className="input" min={1} placeholder="예: 200" {...register("rate_limit_burst")} />
      </div>
      <p className="col-span-2 text-xs text-gray-400">
        일반 웹: 100/200 · API: 50/100 · 관리자: 20/30. 초과 시 429 응답.
      </p>
      {errors.rate_limit_average ? (
        <p className="col-span-2 mt-1 text-xs text-red-500">{errors.rate_limit_average.message}</p>
      ) : null}
    </div>
  );
}
