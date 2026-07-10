"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { User } from "../api/userApi";
import { UserFormFields } from "./UserFormFields";
import {
  buildUserFormPayload,
  type UserFormData,
  userFormSchema,
} from "./userFormSchema";

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
  } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
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
        onSubmit(buildUserFormPayload(data));
      })}
      className="space-y-5"
    >
      <UserFormFields isEdit={isEdit} register={register} errors={errors} />

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" className="btn-primary w-full justify-center sm:w-auto" disabled={loading}>
          {loading ? "처리 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
