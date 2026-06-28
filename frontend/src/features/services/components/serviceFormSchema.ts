import { z } from "zod";

import type { AuthMode, FramePolicy } from "../api/serviceApi";
import { parseHealthcheckExpectedStatuses } from "./serviceFormUtils";

export const serviceFormSchema = z.object({
  name: z.string().min(1, "서비스 이름을 입력하세요"),
  domain: z.string().regex(
    /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    "유효한 도메인 형식이 아닙니다",
  ),
  upstream_host: z.string().min(1, "업스트림 호스트를 입력하세요"),
  upstream_port: z.coerce.number().min(1).max(65535, "1~65535 범위의 포트를 입력하세요"),
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
}).superRefine((value, ctx) => {
  if (value.https_redirect_enabled && !value.tls_enabled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["https_redirect_enabled"],
      message: "HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다",
    });
  }
  if (value.auth_mode !== "authentik" && value.authentik_group_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["authentik_group_id"],
      message: "Authentik 인증 모드에서만 그룹을 선택할 수 없습니다",
    });
  }
  if (value.auth_mode !== "none" && value.basic_auth_enabled) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["basic_auth_enabled"],
      message: "외부 인증(Authentik/Token)과 Basic Auth는 동시에 사용할 수 없습니다",
    });
  }
  if (value.rate_limit_enabled && (!value.rate_limit_average || !value.rate_limit_burst)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rate_limit_average"],
      message: "Rate Limit을 활성화하면 average와 burst를 모두 입력해야 합니다",
    });
  }
  if (!value.healthcheck_path.trim().startsWith("/")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["healthcheck_path"],
      message: "헬스 체크 경로는 '/'로 시작해야 합니다",
    });
  }
  try {
    const statuses = parseHealthcheckExpectedStatuses(value.healthcheck_expected_statuses_input);
    if (statuses.some((status) => !Number.isInteger(status) || status < 100 || status > 599)) {
      throw new Error("invalid");
    }
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["healthcheck_expected_statuses_input"],
      message: "기대 상태 코드는 100~599 범위 정수만 입력할 수 있습니다",
    });
  }
});

export type ServiceFormData = z.infer<typeof serviceFormSchema>;

export interface ServiceFormDefaultValues {
  name?: string;
  domain?: string;
  upstream_host?: string;
  upstream_port?: number;
  upstream_scheme?: "http" | "https";
  skip_tls_verify?: boolean;
  tls_enabled?: boolean;
  https_redirect_enabled?: boolean;
  auth_mode?: AuthMode;
  api_key?: string | null;
  basic_auth_enabled?: boolean;
  middleware_template_ids?: string[];
  authentik_group_id?: string | null;
  allowed_ips?: string[];
  blocked_paths?: string[];
  rate_limit_average?: number | null;
  rate_limit_burst?: number | null;
  custom_headers?: Record<string, string>;
  frame_policy?: FramePolicy;
  healthcheck_enabled?: boolean;
  healthcheck_path?: string;
  healthcheck_timeout_ms?: number;
  healthcheck_expected_statuses?: number[];
  basic_auth_usernames?: string[];
}
