import { z } from "zod";

import { toMaintenanceUntilIso } from "../lib/maintenanceSchedule";
import { validateServiceFormRefinements } from "./serviceFormValidation";

const serviceFormBaseSchema = z.object({
  name: z.string().min(1, "서비스 이름을 입력하세요"),
  domain: z.string().regex(
    /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    "유효한 도메인 형식이 아닙니다",
  ),
  upstream_host: z.string().min(1, "업스트림 호스트를 입력하세요"),
  upstream_port: z.coerce.number().min(1).max(65535, "1~65535 범위의 포트를 입력하세요"),
  routing_mode: z.enum(["active", "disabled", "maintenance"]),
  maintenance_message: z.string().max(300, "점검 안내 문구는 300자 이하여야 합니다"),
  maintenance_until: z.string().refine(
    (value) => !value || toMaintenanceUntilIso(value) !== null,
    "올바른 점검 종료 예정 시각을 입력하세요",
  ),
  upstream_scheme: z.enum(["http", "https"]),
  skip_tls_verify: z.boolean(),
  tls_enabled: z.boolean(),
  https_redirect_enabled: z.boolean(),
  auth_mode: z.enum(["none", "authentik", "token"]),
  api_key: z.string().optional().nullable(),
  basic_auth_enabled: z.boolean(),
  middleware_template_ids: z.array(z.string()),
  authentik_group_id: z.string().optional(),
  basic_auth_credentials: z.array(
    z.object({
      username: z.string(),
      password: z.string(),
    }),
  ),
  allowed_ips_input: z.string().optional(),
  blocked_paths_input: z.string().optional(),
  rate_limit_enabled: z.boolean(),
  rate_limit_average: z.coerce.number().int().positive("1 이상의 정수를 입력하세요").optional(),
  rate_limit_burst: z.coerce.number().int().positive("1 이상의 정수를 입력하세요").optional(),
  custom_headers: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ),
  frame_policy: z.enum(["deny", "sameorigin", "off"]),
  healthcheck_enabled: z.boolean(),
  healthcheck_path: z.string(),
  healthcheck_timeout_ms: z.coerce.number().int().positive("1 이상의 정수를 입력하세요"),
  healthcheck_expected_statuses_input: z.string().optional(),
});

export type ServiceFormBaseData = z.infer<typeof serviceFormBaseSchema>;

export const serviceFormSchema = serviceFormBaseSchema.superRefine(validateServiceFormRefinements);

export type ServiceFormData = z.infer<typeof serviceFormSchema>;
export type { ServiceFormDefaultValues } from "./serviceFormTypes";
