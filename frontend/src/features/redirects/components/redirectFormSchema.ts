import { z } from "zod";

export const redirectFormSchema = z.object({
  domain: z.string().regex(
    /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    "유효한 도메인 형식이 아닙니다",
  ),
  target_url: z.string().min(1, "리다이렉트 대상 URL을 입력하세요"),
  permanent: z.boolean(),
  tls_enabled: z.boolean(),
});

export type RedirectFormData = z.infer<typeof redirectFormSchema>;
