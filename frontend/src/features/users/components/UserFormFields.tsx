import type { FieldErrors, UseFormRegister } from "react-hook-form";

import type { UserFormData } from "./userFormSchema";

interface UserFormFieldsProps {
  isEdit: boolean;
  register: UseFormRegister<UserFormData>;
  errors: FieldErrors<UserFormData>;
}

export function UserFormFields({ isEdit, register, errors }: UserFormFieldsProps) {
  return (
    <>
      <div>
        <label className="label">사용자 이름</label>
        <input className="input" placeholder="예: viewer01" {...register("username")} />
        {errors.username ? <p className="mt-1 text-xs text-red-500">{errors.username.message}</p> : null}
      </div>

      <div>
        <label className="label">{isEdit ? "새 비밀번호 (선택)" : "비밀번호"}</label>
        <input
          type="password"
          className="input"
          placeholder={isEdit ? "비워두면 기존 비밀번호 유지" : "비밀번호 입력"}
          {...register("password")}
        />
        {errors.password ? <p className="mt-1 text-xs text-red-500">{errors.password.message}</p> : null}
      </div>

      <div>
        <label className="label">역할</label>
        <select className="input" {...register("role")}>
          <option value="admin">admin</option>
          <option value="viewer">viewer</option>
        </select>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 rounded accent-blue-600" {...register("is_active")} />
        <div>
          <span className="text-sm font-medium text-gray-700">계정 활성화</span>
          <p className="text-xs text-gray-500">비활성화된 사용자는 로그인할 수 없습니다</p>
        </div>
      </label>
    </>
  );
}
