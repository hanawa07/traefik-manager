import { z } from "zod";

import { parseHealthcheckExpectedStatuses } from "./serviceFormUtils";
import type { ServiceFormBaseData } from "./serviceFormSchema";

export function validateServiceFormRefinements(value: ServiceFormBaseData, ctx: z.RefinementCtx) {
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
}
