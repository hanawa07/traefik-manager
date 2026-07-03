import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { MiddlewareFormData } from "./middlewareFormModel";

interface IpAllowListConfigFieldsProps {
  register: UseFormRegister<MiddlewareFormData>;
  errors: FieldErrors<MiddlewareFormData>;
}

export function IpAllowListConfigFields({ register, errors }: IpAllowListConfigFieldsProps) {
  return (
    <div>
      <label className="label">허용 IP 목록</label>
      <textarea
        className="input min-h-24"
        placeholder={"예:\n192.168.0.0/24\n10.0.0.1"}
        {...register("source_range_input")}
      />
      <p className="mt-1 text-xs text-gray-400">
        한 줄에 IP 또는 CIDR 형식으로 입력. 목록에 없는 IP는 403 차단됩니다.
      </p>
      {errors.source_range_input ? (
        <p className="mt-1 text-xs text-red-500">{errors.source_range_input.message}</p>
      ) : null}
    </div>
  );
}
