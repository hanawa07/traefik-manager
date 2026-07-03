import { z } from "zod";

export const userFormSchema = z.object({
  username: z.string().min(1, "사용자 이름을 입력하세요"),
  password: z.string().optional(),
  role: z.enum(["admin", "viewer"]),
  is_active: z.boolean(),
});

export type UserFormData = z.infer<typeof userFormSchema>;

export function buildUserFormPayload(data: UserFormData) {
  return {
    username: data.username.trim(),
    role: data.role,
    is_active: data.is_active,
    ...(data.password ? { password: data.password } : {}),
  };
}
