"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { User } from "../api/userApi";

export interface UserFormValue {
  username: string;
  password?: string;
  role: "admin" | "viewer";
  is_active: boolean;
}

interface UserFormProps {
  defaultValues?: User;
  loading?: boolean;
  submitLabel?: string;
  onSubmit: (data: UserFormValue) => void;
}

const schema = z.object({
  username: z.string().min(1, "사용자 이름을 입력하세요"),
  password: z.string().optional(),
  role: z.enum(["admin", "viewer"]),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function UserForm({
  defaultValues,
  loading,
  submitLabel = "저장",
  onSubmit,
}: UserFormProps) {
  const isEdit = !!defaultValues;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: defaultValues?.username || "",
      password: "",
      role: defaultValues?.role || "viewer",
      is_active: defaultValues?.is_active ?? true,
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => {
        if (!isEdit && !data.password) {
          setError("password", { message: "비밀번호를 입력하세요" });
          return;
        }
        const payload = {
          username: data.username.trim(),
          role: data.role,
          is_active: data.is_active,
          ...(data.password ? { password: data.password } : {}),
        };
        onSubmit(payload);
      })}
      className="space-y-5"
    >
      <div>
        <label className="label">사용자 이름</label>
        <input className="input" placeholder="예: viewer01" {...register("username")} />
        {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>}
      </div>

      <div>
        <label className="label">{isEdit ? "새 비밀번호 (선택)" : "비밀번호"}</label>
        <input
          type="password"
          className="input"
          placeholder={isEdit ? "비워두면 기존 비밀번호 유지" : "비밀번호 입력"}
          {...register("password")}
        />
        {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
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

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "처리 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
