import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { MiddlewareFormData } from "./middlewareFormModel";

interface BasicAuthConfigFieldsProps {
  register: UseFormRegister<MiddlewareFormData>;
  errors: FieldErrors<MiddlewareFormData>;
}

export function BasicAuthConfigFields({ register, errors }: BasicAuthConfigFieldsProps) {
  return (
    <div>
      <label className="label">users (htpasswd 형식)</label>
      <textarea
        className="input min-h-24"
        placeholder={"예:\nadmin:$apr1$...\nviewer:$2y$..."}
        {...register("basic_auth_users_input")}
      />
      {errors.basic_auth_users_input ? (
        <p className="mt-1 text-xs text-red-500">{errors.basic_auth_users_input.message}</p>
      ) : null}
      <p className="mt-1 text-xs text-gray-500">한 줄에 `username:hashedPassword` 형태로 입력합니다</p>
    </div>
  );
}
